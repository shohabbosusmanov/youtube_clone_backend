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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { VideoService } from './video.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
    return this.videoService.getUserVideos(userId);
  }
}
