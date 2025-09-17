import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CoreMOdule } from './core/core.module';
import { VideoModule } from './modules/video/video.module';
import { LikeModule } from './modules/like/like.module';
import { CommentModule } from './modules/comment/comment.module';

@Module({
  imports: [AuthModule, UsersModule, CoreMOdule, VideoModule, LikeModule, CommentModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
