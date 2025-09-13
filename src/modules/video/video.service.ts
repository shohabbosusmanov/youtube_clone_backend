import { Injectable, InternalServerErrorException } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import fsp from 'fs/promises';
import path from 'path';
import { PrismaService } from 'src/core/database/prisma.service';

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

      // Удаляем исходный файл
      try {
        await fsp.unlink(inputPath);
      } catch {}

      // Теперь транзакция: если запись не создастся — откатится
      const saved = await this.prisma.$transaction(async (tx) => {
        return tx.video.create({
          data: {
            title: uploadVideoDto.title,
            description: uploadVideoDto.description || '',
            thumbnail: `${baseUrl}/static/videos/${baseName}/thumbnail.jpg`,
            videoUrl: baseName,
            author: {
              connect: { id: authorId }, // Здесь передаём связанного пользователя
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
    return this.prisma.video.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        likes: true,
        comments: true,
      },
    });
  }
}
