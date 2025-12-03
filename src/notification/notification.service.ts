// src/notification/notification.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service'; // Giả sử bạn đã có PrismaService
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationType } from 'src/common/enums/notificationType.enum';
import { EventsGateway } from 'src/events/events.gateway';

@Injectable()
export class NotificationService {
    constructor(private prisma: PrismaService, private eventsGateway: EventsGateway) { }

    // 1. Tạo thông báo mới
    async create(dto: CreateNotificationDto) {
        const notification = await this.prisma.notification.create({
            data: {
                userId: dto.userId,
                title: dto.title,
                message: dto.message,
                type: dto.type, // Prisma schema là String, nhưng ta truyền vào Enum value
            },
        });

        // TODO: Tại đây bạn có thể gọi SocketGateway để bắn event realtime báo có notification mới
        const unreadCount = (await this.countUnread(dto.userId)).unreadCount;
        this.eventsGateway.sendToUser(dto.userId, 'new_notification', unreadCount,);

        return notification;
    }

    // 2. Lấy danh sách thông báo của một User (có phân trang)
    async findAllByUser(userId: number, page: number = 1, limit: number = 10, type?: string, isRead?: boolean, excludeType?: string) {
        const skip = (page - 1) * limit;

        // Xây dựng điều kiện lọc
        const whereCondition: any = { userId };

        if (type) {
            whereCondition.type = type;
        }
        if (excludeType) {
            whereCondition.type = { not: excludeType };
        }

        // [MỚI] Nếu isRead có giá trị (true/false) thì thêm vào điều kiện
        if (isRead !== undefined && isRead !== null) {
            whereCondition.isRead = isRead;
        }

        const [notifications, total] = await Promise.all([
            this.prisma.notification.findMany({
                where: whereCondition,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: skip,
            }),
            this.prisma.notification.count({ where: whereCondition }),
        ]);

        return {
            data: notifications,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // 3. Đếm số lượng thông báo chưa đọc
    async countUnread(userId: number) {
        const count = await this.prisma.notification.count({
            where: {
                userId,
                isRead: false,
            },
        });
        return { unreadCount: count };
    }

    // 4. Đánh dấu 1 thông báo là đã đọc
    async markAsRead(id: number, userId: number) {
        // Kiểm tra xem thông báo có tồn tại và thuộc về user này không
        const notification = await this.prisma.notification.findUnique({
            where: { id },
        });

        if (!notification || notification.userId !== userId) {
            throw new NotFoundException('Notification not found or access denied');
        }

        return await this.prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });
    }

    // 5. Đánh dấu TẤT CẢ là đã đọc
    async markAllAsRead(userId: number) {
        return await this.prisma.notification.updateMany({
            where: {
                userId,
                isRead: false,
            },
            data: { isRead: true },
        });
    }

    // 6. Xóa thông báo (Tùy chọn)
    async remove(id: number, userId: number) {
        const notification = await this.prisma.notification.findUnique({
            where: { id },
        });

        if (!notification || notification.userId !== userId) {
            throw new NotFoundException('Notification not found');
        }

        return await this.prisma.notification.delete({
            where: { id },
        });
    }


    async sendToRoles(
        roles: string[], // VD: ['admin', 'staff']
        title: string,
        message: string,
        type: NotificationType, // Hoặc dùng Enum NotificationType
        payload: any = {}, // Data đính kèm (VD: orderId)
    ) {
        // 1. Tìm danh sách User IDs có role mong muốn
        const users = await this.prisma.user.findMany({
            where: {
                roles: {
                    some: {
                        role_name: { in: roles, mode: 'insensitive' }, // 'staff', 'Staff', 'admin'...
                    },
                },
            },
            select: { id: true },
        });

        const userIds = users.map((u) => u.id);
        if (userIds.length === 0) return;

        // 2. Tạo Notification vào DB (Dùng createMany để tối ưu performance)
        await this.prisma.notification.createMany({
            data: userIds.map((userId) => ({
                userId,
                title,
                message,
                type,
                isRead: false,
            })),
        });

        // 3. Gửi Socket đến từng User Online
        // Lưu ý: Client phải đã join room "user_{id}" như logic trong gateway bạn gửi
        userIds.forEach(async (userId) => {
            // Cách 1: Chỉ bắn tín hiệu có noti mới (nhẹ server)
            // Client nhận được sẽ tự gọi API getUnreadCount hoặc tự +1 badge
            // this.eventsGateway.sendToUser(userId, 'new_notification', {
            //     title,
            //     message,
            //     type,
            //     ...payload
            // });

            // Cách 2: Nếu muốn gửi kèm số lượng chưa đọc luôn (Nặng hơn vì phải count lại cho từng người)

            const { unreadCount } = await this.countUnread(userId);
            this.eventsGateway.sendToUser(userId, 'new_notification', unreadCount);

        });
    }
}