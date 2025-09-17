import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  Req,
  UseGuards,
  Get,
  Param,
  NotFoundException,
  Query,
  Res,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { VideoService } from './video.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ADDRGETNETWORKPARAMS } from 'dns';
import { Request, Response } from 'express';

@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/tmp',
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `${uuid()}${ext}`);
        },
      }),
    }),
  )
  async upload(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title: string; description?: string },
  ) {
    const userId = req.user.sub;

    if (!file) {
      return { error: 'File is required' };
    }

    return this.videoService.uploadVideo(userId, body, file);
  }

  @Get('status/:id')
  async getStatus(@Param('id') id: string) {
    const video = await this.videoService.findVideo(id);
    if (!video) {
      throw new NotFoundException('Video not found');
    }
    return { status: video.status };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-videos')
  async getMyVideos(@Req() req) {
    const userId = req.user.sub;
    const videos = await this.videoService.getUserVideos(userId);

    return videos || [];
  }

  @Get()
  async getVideos(@Query('search') search?: string) {
    return await this.videoService.getVideos(search);
  }

  @Get(':id')
  async getVideo(@Param('id') id: string) {
    return await this.videoService.getVideo(id);
  }

  @Get('watch/:url')
  async watchVideo(
    @Param('url') url: string,
    @Query('quality') quality: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const range = req.headers.range;
    await this.videoService.watchVideo(url, quality, range, res);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/view')
  async addView(@Param('id') videoId: string, @Req() req) {
    const user = req.user;

    return this.videoService.addView(videoId, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/update')
  async updateVideo(
    @Param('id') id: string,
    @Req() req,
    @Body() body: { title?: string; description?: string },
  ) {
    const userId = req.user.sub;
    return this.videoService.updateVideo(id, userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteVideo(@Param('id') id: string, @Req() req) {
    const userId = req.user.sub;
    return this.videoService.deleteVideo(id, userId);
  }
}
