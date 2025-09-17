import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LikeService } from './like.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('likes')
export class LikeController {
  constructor(private readonly likeService: LikeService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':videoId/likes-status')
  async getLikesStatus(@Param('videoId') videoId: string, @Req() req) {
    const userId = req.user.sub;
    if (!userId) return;
    return this.likeService.getLikesStatus(videoId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('like')
  async likeVideo(@Body('videoId') videoId: string, @Req() req) {
    const userId = req.user.sub;
    if (!userId) return;

    return this.likeService.likeVideo(videoId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('unlike')
  async unlikeVideo(@Body('videoId') videoId: string, @Req() req) {
    const userId = req.user.sub;
    if (!userId) return;

    return this.likeService.unlikeVideo(videoId, userId);
  }
}
