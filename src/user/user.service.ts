import { Injectable } from '@nestjs/common';
import { ChangeSensitiveInfoDTO, UserUpdateDTO } from './dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetAllDto, ResponseGetAllDto } from 'src/common/dto/pagination.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) { }

  async updateInfo(
    id: number,
    updateDto: UserUpdateDTO,
  ): Promise<string> {
    const userUpdated = await this.prisma.user.update({
      where: {
        id: id,
      },
      data: {
        // ✅ Cập nhật thông tin ở bảng User
        first_name: updateDto.firstName,
        last_name: updateDto.lastName,

        // ✅ Cập nhật thông tin ở bảng UserDetail
        detail: {
          update: {
            address: updateDto.address,
            sex: updateDto.sex, // Đảm bảo mapping đúng enum Frontend gửi lên
            // Xử lý ngày sinh: Nếu có gửi lên thì mới update
            ...(updateDto.birthday && { birthday: new Date(updateDto.birthday) }),
          },
        },
      },
    });
    return JSON.stringify(userUpdated);
  }

  async getAllUsers(query: GetAllDto) {
    const {
      page,
      size,
      searchName,
      orderBy = 'id',
      orderDirection = 'asc',
    } = query;
    if (!page || !size) {
      throw new Error('page and size are required');
    }

    const skip = (page - 1) * size;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: size,
        where: searchName
          ? { phone_number: { contains: searchName, mode: 'insensitive' } }
          : {},
        select: {
          id: true,
          email: true,
          phone_number: true,
          first_name: true,
          last_name: true,
          is_locked: true,
          detail: true,
          roles: true,
        },
        orderBy: { [orderBy]: orderDirection },
      }),
      this.prisma.user.count(),
    ]);

    const res: ResponseGetAllDto<any> = {
      data: data,
      meta: {
        page: page,
        size: size,
        total: total,
        totalPages: Math.ceil(total / size),
      },
    };
    return res;
  }

  async lockUser(id: number) {
    const user = await this.prisma.user.update({
      where: { id },
      // lock account
      data: { is_locked: true },
      select: {
        id: true,
        phone_number: true,
        first_name: true,
        last_name: true,
        is_locked: true,
        email: true,
      },
    });
    return user;
  }

  async unlockUser(id: number) {
    const user = await this.prisma.user.update({
      where: { id },
      // unlock account
      data: { is_locked: false },
      select: {
        id: true,
        phone_number: true,
        first_name: true,
        last_name: true,
        is_locked: true,
        email: true,
      },
    });
    return user;
  }

  changeSensitiveInfo(id: number, body: ChangeSensitiveInfoDTO) {
    const user = this.prisma.user.update({
      where: { id },
      data: {
        email: body.email,
        phone_number: body.phone,
      },
    });

    return user;
  }

  getHello(): string {
    return 'Hello World!';
  }

  async getAllUsersForPos(query: GetAllDto) {
    const {
      page,
      size,
      searchName,
      orderBy = 'id',
      orderDirection = 'asc',
    } = query;

    if (!page || !size) {
      throw new Error('page and size are required');
    }

    if (!searchName || searchName.trim() === '') {
      return {
        data: [],
        meta: { page, size, total: 0, totalPages: 0 },
      };
    }

    const whereClause: Prisma.UserWhereInput = searchName
      ? { phone_number: { contains: searchName, mode: 'insensitive' } }
      : {};

    const skip = (page - 1) * size;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: size,
        where: whereClause,
        orderBy: { [orderBy]: orderDirection },
        select: {
          id: true,
          phone_number: true,
          email: true,
          first_name: true,
          last_name: true,
          is_locked: true,
          detail: true,
          CustomerPoint: true,
          Voucher: {
            where: {
              is_active: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where: whereClause }),
    ]);

    return {
      data,
      meta: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size),
      },
    };
  }

  async updateAvatar(userId: number, avatarUrl: string) {
    const userUpdated = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        detail: {
          update: {
            avatar_url: avatarUrl,
          },
        },
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        detail: {
          select: {
            avatar_url: true // Chỉ trả về avatar mới để FE cập nhật
          }
        }
      }
    });

    return userUpdated;
  }


  async getMyPoints(phone: string) {
    const pointRecord = await this.prisma.customerPoint.findUnique({
      where: { customerPhone: phone },
      include: {
        loyalLevel: true,
      },
    });

    if (!pointRecord) {
      // Nếu chưa có điểm thì tạo mặc định
      return { points: 0, loyalLevel: null };
    }

    return {
      points: pointRecord.points,
      loyalLevel: pointRecord.loyalLevel,
    };
  }
}
