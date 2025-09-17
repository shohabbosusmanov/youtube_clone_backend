import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get(':videoId')
  async getComments(@Param('videoId') videoId: string) {
    return this.commentService.getCommentsByVideoId(videoId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createComment(@Body() body, @Req() req) {
    const userId = req.user.sub;
    const { videoId, text } = body;
    return this.commentService.createComment({ videoId, userId, text });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateComment(@Param('id') id: string, @Body() body, @Req() req) {
    const userId = req.user.sub;

    const isOwner = await this.commentService.isCommentOwner(id, userId);
    if (!isOwner) throw new ForbiddenException('Access denied');

    return this.commentService.updateComment(id, body.text);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteComment(@Param('id') id: string, @Req() req) {
    const userId = req.user.sub;

    const isOwner = await this.commentService.isCommentOwner(id, userId);
    if (!isOwner) throw new ForbiddenException('Access denied');

    return this.commentService.deleteComment(id);
  }
}
