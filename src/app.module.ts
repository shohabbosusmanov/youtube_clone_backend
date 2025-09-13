import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CoreMOdule } from './core/core.module';
import { VideoModule } from './modules/video/video.module';

@Module({
  imports: [AuthModule, UsersModule, CoreMOdule, VideoModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
