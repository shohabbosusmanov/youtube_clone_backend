import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async validateOAuthLogin(profile: any) {
    const { googleId, email, username, picture } = profile;

    let user = await this.prisma.user.findUnique({
      where: { googleId },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          googleId,
          email,
          username,
          picture,
        },
      });
    }

    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      picture: user.picture,
    };
    return {
      access_token: this.jwt.sign(payload),
    };
  }
}
