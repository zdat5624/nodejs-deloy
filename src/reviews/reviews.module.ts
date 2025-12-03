import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { PrismaModule } from 'src/prisma/prisma.module'; // Import module Prisma của bạn
import { EventsModule } from 'src/events/events.module';

@Module({
    imports: [PrismaModule, EventsModule],
    controllers: [ReviewsController],
    providers: [ReviewsService],
})
export class ReviewsModule { }