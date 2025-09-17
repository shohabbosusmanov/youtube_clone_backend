import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async getLikedVideos(userId: string) {
    return this.prisma.video.findMany({
      where: {
        likes: {
          some: { userId },
        },
      },
      include: {
        _count: {
          select: { comments: true, likes: true, views: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
