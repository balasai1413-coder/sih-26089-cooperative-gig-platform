import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CooperativesModule } from './cooperatives/cooperatives.module';
import { HealthController } from './health.controller';
import { MatchingModule } from './matching/matching.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ServiceRequestsModule } from './service-requests/service-requests.module';
import { SkillsModule } from './skills/skills.module';
import { WorkersModule } from './workers/workers.module';
import { BookingsModule } from './bookings/bookings.module';
import { VerificationModule } from './verification/verification.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WelfareModule } from './welfare/welfare.module';
import { DemandForecastingModule } from './demand-forecasting/demand-forecasting.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', 'apps/api/.env'] }),
    AuthModule,
    BookingsModule,
    CooperativesModule,
    DemandForecastingModule,
    MatchingModule,
    NotificationsModule,
    PaymentsModule,
    ReviewsModule,
    ServiceRequestsModule,
    SkillsModule,
    WorkersModule,
    VerificationModule,
    WelfareModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
