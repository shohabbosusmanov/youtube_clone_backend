import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class CommentService {
  constructor(private prisma: PrismaService) {}

  async getCommentsByVideoId(videoId: string) {
    return this.prisma.comment.findMany({
      where: { videoId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            picture: true,
          },
        },
      },
    });
  }

  async createComment({
    videoId,
    userId,
    text,
  }: {
    videoId: string;
    userId: string;
    text: string;
  }) {
    return this.prisma.comment.create({
      data: {
        videoId,
        userId,
        text,
      },
      include: {
        user: {
          select: {
            username: true,
            picture: true,
          },
        },
      },
    });
  }

  async updateComment(commentId: string, text: string) {
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { text },
    });
  }

  async deleteComment(commentId: string) {
    return this.prisma.comment.delete({
      where: { id: commentId },
    });
  }

  async isCommentOwner(commentId: string, userId: string): Promise<boolean> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    });

    return comment?.userId === userId;
  }
}
