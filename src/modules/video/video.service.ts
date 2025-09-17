import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import ffmpeg from 'fluent-ffmpeg';
import fsp from 'fs/promises';
import path from 'path';
import { PrismaService } from 'src/core/database/prisma.service';
import fs from 'fs';

@Injectable()
export class VideoService {
  constructor(private prisma: PrismaService) {}

  async uploadVideo(
    authorId: string,
    uploadVideoDto: { title: string; description?: string },
    file: Express.Multer.File,
  ) {
    const baseUrl = process.env.SERVER_URL || 'http://localhost:4000';
    const inputPath = file.path;
    const baseName = path.parse(file.filename).name;
    const outputDir = path.join('uploads', 'videos', baseName);

    try {
      await fsp.mkdir(outputDir, { recursive: true });

      const metadata = await new Promise<ffmpeg.FfprobeData>(
        (resolve, reject) => {
          ffmpeg.ffprobe(inputPath, (err, data) => {
            if (err) return reject(err);
            resolve(data);
          });
        },
      );

      const videoStream = metadata.streams.find(
        (s) => s.codec_type === 'video',
      );
      const height = videoStream?.height ?? 0;

      const duration = Math.round(metadata.format?.duration || 0);

      const availableResolutions = [
        { name: '4320p', size: '7680x4320', height: 4320 },
        { name: '2160p', size: '3840x2160', height: 2160 },
        { name: '1080p', size: '1920x1080', height: 1080 },
        { name: '720p', size: '1280x720', height: 720 },
        { name: '480p', size: '854x480', height: 480 },
        { name: '360p', size: '640x360', height: 360 },
        { name: '240p', size: '426x240', height: 240 },
        { name: '144p', size: '256x144', height: 144 },
      ];

      const originalRes = availableResolutions.find(
        (res) => res.height === height,
      );
      const targetResolutions = availableResolutions.filter(
        (res) => res.height < height,
      );

      if (originalRes) {
        const originalTargetPath = path.join(
          outputDir,
          `${originalRes.name}.mp4`,
        );
        await fsp.copyFile(inputPath, originalTargetPath);
      }

      const resizePromises = targetResolutions.map((res) => {
        return new Promise<void>((resolve, reject) => {
          const outputPath = path.join(outputDir, `${res.name}.mp4`);
          ffmpeg(inputPath)
            .outputOptions('-preset fast')
            .size(res.size)
            .output(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
        });
      });

      const thumbnailPromise = new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .screenshots({
            timestamps: ['00:00:05'],
            filename: 'thumbnail.jpg',
            folder: outputDir,
            size: '1280x720',
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });

      await Promise.all([...resizePromises, thumbnailPromise]);

      try {
        await fsp.unlink(inputPath);
      } catch {}

      const saved = await this.prisma.$transaction(async (tx) => {
        return tx.video.create({
          data: {
            title: uploadVideoDto.title,
            description: uploadVideoDto.description || '',
            thumbnail: `${baseUrl}/static/videos/${baseName}/thumbnail.jpg`,
            videoUrl: baseName,
            duration,
            author: {
              connect: { id: authorId },
            },
            status: 'done',
          },
        });
      });

      return {
        message: 'Video processed and saved',
        videoId: saved.id,
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Video processing failed');
    }
  }

  async findVideo(videoId: string) {
    return this.prisma.video.findUnique({
      where: { id: videoId },
      select: { status: true },
    });
  }

  async getUserVideos(userId: string) {
    return await this.prisma.video.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            comments: true,
            likes: true,
            views: true,
          },
        },
      },
    });
  }

  async getVideos(search?: string) {
    if (search) {
      return await this.prisma.video.findMany({
        where: {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },
        include: {
          author: { select: { username: true, picture: true } },
          _count: { select: { views: true } },
        },
      });
    } else {
      return await this.prisma.video.findMany({
        include: {
          author: { select: { username: true, picture: true } },
          _count: { select: { views: true } },
        },
      });
    }
  }

  async getVideo(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: {
        author: true,
        _count: {
          select: {
            likes: true,
            views: true,
            comments: true,
          },
        },
        comments: { include: { user: true } },
      },
    });

    if (!video) return false;

    return video;
  }

  async watchVideo(
    url: string,
    quality: string,
    range: string | undefined,
    res: Response,
  ) {
    try {
      const video = await this.prisma.video.findFirst({
        where: { videoUrl: url },
      });

      if (!video) throw new NotFoundException('Video not found');

      const basePath = path.join(process.cwd(), 'uploads', 'videos');
      const videoDir = path.join(basePath, url);
      const fileName = `${quality}.mp4`;
      const videoPath = path.join(videoDir, fileName);

      if (!fs.existsSync(videoPath)) {
        throw new NotFoundException('Video quality not found');
      }

      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;

      if (!range) {
        range = `bytes=0-${fileSize - 1}`;
      }

      const CHUNK_SIZE = 1 * 1_048_576;

      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1]
        ? parseInt(parts[1], 10)
        : Math.min(start + CHUNK_SIZE, fileSize - 1);
      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(videoPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      });

      stream.pipe(res);

      stream.on('error', (err) => {
        console.error('Stream error:', err);
        res.sendStatus(500);
      });
    } catch (error) {
      console.error('Streaming failed:', error);
      throw new InternalServerErrorException('Failed to stream video');
    }
  }

  async addView(videoId: string, userId: string) {
    if (!userId) return;

    const existingView = await this.prisma.view.findUnique({
      where: {
        videoId_userId: {
          videoId,
          userId,
        },
      },
    });

    if (existingView) {
      return { success: true };
    }

    await this.prisma.$transaction([
      this.prisma.view.create({
        data: {
          videoId,
          userId,
        },
      }),
      this.prisma.video.update({
        where: { id: videoId },
        data: {
          viewsCount: { increment: 1 },
        },
      }),
    ]);

    return { success: true };
  }

  async updateVideo(
    videoId: string,
    userId: string,
    body: { title?: string; description?: string },
  ) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video || video.authorId !== userId) {
      throw new NotFoundException('Video not found or unauthorized');
    }

    return await this.prisma.video.update({
      where: { id: videoId },
      data: {
        title: body.title,
        description: body.description,
        updatedAt: new Date(),
      },
    });
  }

  async deleteVideo(videoId: string, userId: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video || video.authorId !== userId) {
      throw new NotFoundException('Video not found or unauthorized');
    }

    const videoDir = path.join(
      process.cwd(),
      'uploads',
      'videos',
      video.videoUrl,
    );
    try {
      await fsp.rm(videoDir, { recursive: true, force: true });
    } catch (err) {
      console.error('Failed to delete video files:', err);
    }

    await this.prisma.video.delete({
      where: { id: videoId },
    });

    return { message: 'Video deleted successfully' };
  }
}
