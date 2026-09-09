import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Authorize } from '../auth/decorators/authorize.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ReviewsService } from './reviews.service';

@Controller('workers/me')
@Authorize({ roles: [UserRole.WORKER] })
export class WorkerReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('reviews')
  listMyReviews(@CurrentUser() user: AuthenticatedUser) {
    return this.reviewsService.listWorkerReviews(user);
  }
}
