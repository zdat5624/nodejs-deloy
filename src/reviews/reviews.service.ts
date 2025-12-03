import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { FilterReviewDto } from './dto/filter-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { EventsGateway } from 'src/events/events.gateway';

@Injectable()
export class ReviewsService {
    constructor(
        private prisma: PrismaService,
        private eventsGateway: EventsGateway
    ) { }

    // ====================================================================
    // 1. CREATE: Tạo đánh giá mới
    // ====================================================================
    async create(userId: number, dto: CreateReviewDto) {
        // Check trùng: Một người chỉ được review 1 sản phẩm 1 lần
        const existingReview = await this.prisma.productReview.findFirst({
            where: {
                userId: userId,
                productId: dto.productId,
            },
        });

        if (existingReview) {
            throw new BadRequestException('You have already reviewed this product.');
        }

        // Tạo review
        const newReview = await this.prisma.productReview.create({
            data: {
                userId,
                productId: dto.productId,
                rating: dto.rating,
                comment: dto.comment,
                isHidden: false, // Mặc định hiện
            },
            // Include user để Socket trả về có luôn Avatar/Tên hiển thị ngay lập tức
            include: {
                user: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        detail: { select: { avatar_url: true } },
                    },
                },
            },
        });

        // --> SOCKET: Báo cho mọi người biết có review mới
        this.eventsGateway.sendToAll('review_created', newReview);

        return newReview;
    }

    // ====================================================================
    // 2. FIND ALL: Lấy danh sách (Có lọc & Phân trang)
    // ====================================================================
    async findAll(query: FilterReviewDto) {
        const { page, items_per_page, productId, rating, excludeUserId, isHidden } = query;
        const skip = (page - 1) * items_per_page;

        // 1. Điều kiện lọc cho danh sách review (List Condition)
        const listWhereCondition: any = {
            productId,
            ...(rating ? { rating } : {}), // Nếu user lọc 5 sao, list chỉ hiện 5 sao
        };

        // 2. Điều kiện lọc cho thống kê (Stats Condition)
        // Stats luôn phải tính trên TẤT CẢ review của sản phẩm (không bị ảnh hưởng bởi filter rating của user)
        const statsWhereCondition: any = {
            productId,
            isHidden: false, // Stats chỉ tính review hiện (không tính review ẩn)
        };

        // Xử lý isHidden và excludeUserId giống nhau cho cả 2
        if (isHidden !== undefined && isHidden !== null) {
            listWhereCondition.isHidden = isHidden;
        }

        if (excludeUserId) {
            listWhereCondition.userId = { not: excludeUserId };
            // Stats có thể bao gồm hoặc không bao gồm user hiện tại tùy logic business. 
            // Ở đây ta cứ để stats tính toàn bộ (bao gồm cả user hiện tại) cho chính xác tổng quan.
        }

        const [reviews, total, distribution, aggregation] = await Promise.all([
            // A. Lấy danh sách phân trang
            this.prisma.productReview.findMany({
                where: listWhereCondition,
                skip,
                take: items_per_page,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true, first_name: true, last_name: true,
                            detail: { select: { avatar_url: true } },
                        },
                    },
                },
            }),
            // B. Đếm tổng số record (cho phân trang)
            this.prisma.productReview.count({ where: listWhereCondition }),

            // C. Tính phân bổ sao (1-5)
            this.prisma.productReview.groupBy({
                by: ['rating'],
                where: statsWhereCondition,
                _count: { rating: true },
            }),

            // D. Tính điểm trung bình
            this.prisma.productReview.aggregate({
                where: statsWhereCondition,
                _avg: { rating: true },
                _count: { rating: true }, // Tổng số review thực tế (dùng cho stats)
            })
        ]);

        // Format lại dữ liệu Stats cho đẹp
        const totalReviews = aggregation._count.rating || 0;
        const averageRating = aggregation._avg.rating || 0;

        const stars = [5, 4, 3, 2, 1].map(star => {
            const found = distribution.find(d => d.rating === star);
            const count = found ? found._count.rating : 0;
            const percent = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
            return { star, count, percent };
        });

        return {
            data: reviews,
            meta: {
                total, // Tổng số item theo filter hiện tại (để phân trang)
                currentPage: page,
                itemsPerPage: items_per_page,
                totalPages: Math.ceil(total / items_per_page),
                // Dữ liệu thống kê thêm vào response
                statistics: {
                    totalReviews,
                    averageRating: Number(averageRating.toFixed(1)),
                    stars // Mảng phân bổ %
                }
            },
        };
    }

    // ====================================================================
    // 3. FIND MY REVIEW: Lấy review của chính user (để hiện đầu trang)
    // ====================================================================
    async findMyReview(userId: number, productId: number) {
        return this.prisma.productReview.findFirst({
            where: { userId, productId },
            include: {
                user: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        detail: { select: { avatar_url: true } },
                    },
                },
            },
        });
    }

    // ====================================================================
    // 4. UPDATE: Sửa nội dung đánh giá (User dùng)
    // ====================================================================
    async update(userId: number, id: number, dto: UpdateReviewDto) {
        const review = await this.prisma.productReview.findUnique({ where: { id } });

        if (!review) throw new NotFoundException('Review does not exist.');

        // Check quyền: Phải là chính chủ mới được sửa
        if (review.userId !== userId) {
            throw new BadRequestException('You do not have permission to edit this review.');
        }

        const updatedReview = await this.prisma.productReview.update({
            where: { id },
            data: {
                rating: dto.rating,
                comment: dto.comment,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        detail: { select: { avatar_url: true } },
                    },
                },
            },
        });

        // --> SOCKET: Báo review đã cập nhật
        this.eventsGateway.sendToAll('review_updated', updatedReview);

        return updatedReview;
    }

    // ====================================================================
    // 5. DELETE: Xóa đánh giá (User dùng)
    // ====================================================================
    async remove(userId: number, id: number) {
        const review = await this.prisma.productReview.findUnique({ where: { id } });

        if (!review) throw new NotFoundException('Review does not exist.');

        // Check quyền: Chính chủ mới được xóa (Hoặc có thể mở rộng cho Admin xóa ở hàm khác)
        if (review.userId !== userId) {
            throw new BadRequestException('You do not have permission to delete this review.');
        }

        await this.prisma.productReview.delete({ where: { id } });

        // --> SOCKET: Báo review đã bị xóa (FE cần ID và ProductID để update list)
        this.eventsGateway.sendToAll('review_deleted', {
            id: id,
            productId: review.productId
        });

        return { message: 'Review deleted successfully' };
    }

    // ====================================================================
    // 6. TOGGLE HIDDEN: Ẩn/Hiện đánh giá (Admin dùng)
    // ====================================================================
    async toggleHidden(id: number) {
        const review = await this.prisma.productReview.findUnique({ where: { id } });
        if (!review) throw new NotFoundException('Review not found');

        const updatedReview = await this.prisma.productReview.update({
            where: { id },
            data: { isHidden: !review.isHidden }, // Đảo ngược trạng thái
            include: {
                user: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        detail: { select: { avatar_url: true } },
                    },
                },
            },
        });

        // --> SOCKET: Realtime update
        // Nếu bị ẩn, FE user thường sẽ tự lọc bỏ khỏi list
        // Nếu được hiện lại, FE user sẽ thấy nó xuất hiện
        this.eventsGateway.sendToAll('review_updated', updatedReview);

        return updatedReview;
    }


    // ====================================================================
    // 7. GET RATING SUMMARY: Lấy điểm trung bình và tổng số đánh giá (Public)
    // ====================================================================
    async getProductRatingSummary(productId: number) {
        const aggregation = await this.prisma.productReview.aggregate({
            where: {
                productId: productId,
                isHidden: false, // Chỉ tính đánh giá công khai
            },
            _avg: {
                rating: true,
            },
            _count: {
                rating: true,
            },
        });

        return {
            averageRating: aggregation._avg.rating
                ? Number(aggregation._avg.rating.toFixed(1)) // Làm tròn 1 chữ số thập phân (VD: 4.5)
                : 0,
            totalRatings: aggregation._count.rating || 0,
        };
    }
}