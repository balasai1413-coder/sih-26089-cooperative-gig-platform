import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WelfareController } from './welfare.controller';
import { WelfareService } from './welfare.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [WelfareController],
  providers: [WelfareService],
  exports: [WelfareService],
})
export class WelfareModule {}
