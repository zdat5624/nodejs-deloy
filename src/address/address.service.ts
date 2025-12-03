import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressService {
    constructor(private prisma: PrismaService) { }

    // =================================================================
    // CREATE ADDRESS
    // =================================================================
    async create(userId: number, dto: CreateAddressDto) {
        // 1. Kiểm tra xem đây có phải địa chỉ đầu tiên không
        const count = await this.prisma.userAddress.count({ where: { userId } });

        // Nếu là địa chỉ đầu tiên, bắt buộc set default. 
        // Nếu không phải đầu tiên, dùng giá trị từ DTO (hoặc false)
        const isDefault = count === 0 ? true : (dto.isDefault || false);

        // 2. Nếu set là default, cần bỏ default của các địa chỉ cũ
        if (isDefault && count > 0) {
            await this.prisma.userAddress.updateMany({
                where: { userId },
                data: { isDefault: false },
            });
        }

        return this.prisma.userAddress.create({
            data: {
                userId,
                recipientName: dto.recipientName,
                phoneNumber: dto.phoneNumber,
                fullAddress: dto.fullAddress,
                isDefault: isDefault,
            },
        });
    }

    // =================================================================
    // GET ALL ADDRESSES
    // =================================================================
    async findAll(userId: number) {
        return this.prisma.userAddress.findMany({
            where: { userId },
            orderBy: { isDefault: 'desc' }, // Đưa địa chỉ mặc định lên đầu
        });
    }

    // =================================================================
    // GET ONE ADDRESS
    // =================================================================
    async findOne(userId: number, addressId: number) {
        const address = await this.prisma.userAddress.findUnique({
            where: { id: addressId },
        });

        if (!address) throw new NotFoundException('Address not found');
        if (address.userId !== userId) throw new ForbiddenException('Access denied');

        return address;
    }

    // =================================================================
    // UPDATE ADDRESS
    // =================================================================
    async update(userId: number, addressId: number, dto: UpdateAddressDto) {
        await this.findOne(userId, addressId); // Check tồn tại và quyền sở hữu

        // Nếu user muốn set địa chỉ này thành default
        if (dto.isDefault === true) {
            await this.prisma.userAddress.updateMany({
                where: { userId },
                data: { isDefault: false },
            });
        }

        return this.prisma.userAddress.update({
            where: { id: addressId },
            data: {
                ...dto,
            },
        });
    }

    // =================================================================
    // DELETE ADDRESS
    // =================================================================
    async remove(userId: number, addressId: number) {
        const address = await this.findOne(userId, addressId);

        // Nếu xóa địa chỉ mặc định, cần cảnh báo hoặc xử lý logic (ở đây cho xóa luôn)
        // Tùy nghiệp vụ: Có thể chặn không cho xóa địa chỉ mặc định

        return this.prisma.userAddress.delete({
            where: { id: addressId },
        });
    }

    // =================================================================
    // SET DEFAULT (Shortcut)
    // =================================================================
    async setDefault(userId: number, addressId: number) {
        await this.findOne(userId, addressId); // Check quyền

        // Dùng transaction để đảm bảo tính nhất quán
        return this.prisma.$transaction([
            // 1. Reset tất cả về false
            this.prisma.userAddress.updateMany({
                where: { userId },
                data: { isDefault: false },
            }),
            // 2. Set cái được chọn thành true
            this.prisma.userAddress.update({
                where: { id: addressId },
                data: { isDefault: true },
            }),
        ]);
    }
}