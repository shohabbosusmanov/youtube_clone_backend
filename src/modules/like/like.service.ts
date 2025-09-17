import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class LikeService {
  constructor(private prisma: PrismaService) {}

  async getLikesStatus(videoId: string, userId?: string) {
    const likesCount = await this.prisma.like.count({
      where: { videoId },
    });

    let likedByCurrentUser = false;
    if (userId) {
      const like = await this.prisma.like.findUnique({
        where: {
          userId_videoId: {
            userId,
            videoId,
          },
        },
      });
      likedByCurrentUser = Boolean(like);
    }

    return { likesCount, likedByCurrentUser };
  }

  async likeVideo(videoId: string, userId: string) {
    const existing = await this.prisma.like.findUnique({
      where: {
        userId_videoId: {
          userId,
          videoId,
        },
      },
    });
    if (existing) return { success: true };

    await this.prisma.like.create({
      data: {
        userId,
        videoId,
      },
    });

    await this.prisma.video.update({
      where: { id: videoId },
      data: {
        likesCount: { increment: 1 },
      },
    });

    return { success: true };
  }

  async unlikeVideo(videoId: string, userId: string) {
    const existing = await this.prisma.like.findUnique({
      where: {
        userId_videoId: {
          userId,
          videoId,
        },
      },
    });
    if (!existing) return { success: true };

    await this.prisma.like.delete({
      where: {
        userId_videoId: {
          userId,
          videoId,
        },
      },
    });

    await this.prisma.video.update({
      where: { id: videoId },
      data: {
        likesCount: { decrement: 1 },
      },
    });

    return { success: true };
  }
}
