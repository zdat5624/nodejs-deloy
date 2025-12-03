import {
    Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { FilterReviewDto } from './dto/filter-review.dto';

// 1. Import Decorator GetUser
import { GetUser } from 'src/auth/decorator/user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UpdateReviewDto } from './dto/update-review.dto';
// 2. Import Guard (Giả sử bạn dùng JwtAuthGuard)

@Controller('reviews')
export class ReviewsController {
    constructor(private readonly reviewsService: ReviewsService) { }

    // -----------------------------------------------------------
    // 1. Tạo review
    // Yêu cầu: Phải đăng nhập
    // -----------------------------------------------------------
    @UseGuards(JwtAuthGuard)
    @Post()
    create(
        @GetUser('id') userId: number, // <--- Lấy thẳng ID user từ decorator
        @Body() createReviewDto: CreateReviewDto
    ) {
        return this.reviewsService.create(userId, createReviewDto);
    }

    // -----------------------------------------------------------
    // 2. Lấy danh sách (Public hoặc có Token)
    // Logic: 
    // - Nếu User gửi Token kèm theo: @GetUser('id') sẽ trả về ID -> ta loại trừ review của họ ra.
    // - Nếu User KHÔNG gửi Token: @GetUser('id') trả về null -> lấy tất cả bình thường.
    // -----------------------------------------------------------
    @Get()
    findAll(
        @Query() filterDto: FilterReviewDto,
        @GetUser('id') userId: number // Trả về null nếu không đăng nhập (tuỳ vào cách bạn config Middleware/Guard)
    ) {
        // Nếu bắt được userId (tức là người dùng đang đăng nhập xem danh sách)
        // Tự động thêm vào bộ lọc để ẩn review của chính họ
        if (userId) {
            filterDto.excludeUserId = userId;
        }

        return this.reviewsService.findAll(filterDto);
    }

    // -----------------------------------------------------------
    // 3. Lấy review của TÔI về sản phẩm X
    // Yêu cầu: Phải đăng nhập
    // -----------------------------------------------------------
    @UseGuards(JwtAuthGuard)
    @Get('my-review/:productId')
    findMyReview(
        @GetUser('id') userId: number,
        @Param('productId') productId: string
    ) {
        return this.reviewsService.findMyReview(userId, +productId);
    }

    // -----------------------------------------------------------
    // 4. Sửa review
    // Yêu cầu: Phải đăng nhập
    // -----------------------------------------------------------
    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    update(
        @GetUser('id') userId: number,
        @Param('id') id: string,
        @Body() updateReviewDto: UpdateReviewDto
    ) {
        return this.reviewsService.update(userId, +id, updateReviewDto);
    }

    // -----------------------------------------------------------
    // 5. Xóa review
    // Yêu cầu: Phải đăng nhập
    // -----------------------------------------------------------


    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    remove(
        @GetUser('id') userId: number,
        @Param('id') id: string
    ) {
        return this.reviewsService.remove(userId, +id);
    }


    @UseGuards(JwtAuthGuard)
    @Patch(':id/toggle-hidden')
    toggleHidden(
        @Param('id') id: string
    ) {
        return this.reviewsService.toggleHidden(+id);
    }

    @Get('summary/:productId')
    getRatingSummary(@Param('productId') productId: string) {
        return this.reviewsService.getProductRatingSummary(+productId);
    }
}