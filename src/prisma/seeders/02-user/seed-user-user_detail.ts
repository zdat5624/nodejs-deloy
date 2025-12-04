import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as argon from 'argon2';
import { Role } from 'src/common/enums/role.enum';


const prisma = new PrismaClient();

export async function seedUsers() {
    Logger.log('🪄 Seeding Users & Roles...');

    // ==========================================================
    // 1. SEED ROLES (Đảm bảo Role tồn tại)
    // ==========================================================
    // Object.values(Role) sẽ trả về mảng: ['manager', 'staff', 'customer', ...]
    const rolesList = Object.values(Role);

    const roleMap = new Map<string, number>();

    for (const roleName of rolesList) {
        const role = await prisma.role.upsert({
            where: { role_name: roleName },
            update: {},
            create: { role_name: roleName },
        });
        roleMap.set(roleName, role.id);
    }

    // ==========================================================
    // 2. CHECK USER TỒN TẠI
    // ==========================================================
    const count = await prisma.user.count();
    if (count > 0) {
        Logger.log('⚠️ Users already exist → Skip');
        return prisma.user.findMany({ include: { roles: true } });
    }

    // ==========================================================
    // 3. PREPARE DATA (25 Users)
    // ==========================================================

    // Tối ưu: Hash password 1 lần dùng chung (cho nhanh)
    const commonHash = await argon.hash('123456');

    // 3.1: 3 User cố định (Admin, Staff, Customer mẫu)
    const usersData: any[] = [
        {
            email: 'admin@coffeetek.com',
            phone_number: '0987654321',
            first_name: 'Account',
            last_name: 'Administrator',
            role: 'owner',
            detail: { birthday: new Date('1995-01-01'), sex: 'male', avatar_url: 'https://i.pravatar.cc/150?u=admin', address: 'VP CoffeeTek, TP.HCM' },
        },
        {
            email: 'staff@coffeetek.com',
            phone_number: '0987654322',
            first_name: 'Account',
            last_name: 'Staff',
            role: Role.STAFF,
            detail: { birthday: new Date('2000-05-15'), sex: 'male', avatar_url: 'https://i.pravatar.cc/150?u=staff', address: 'Q. Bình Thạnh, TP.HCM' },
        },
        {
            email: 'stock@coffeetek.com',
            phone_number: '0987654323',
            first_name: 'Account',
            last_name: 'Stocktaker',
            role: Role.STAFF,
            detail: { birthday: new Date('2000-05-15'), sex: 'female', avatar_url: 'https://i.pravatar.cc/150?u=staff', address: 'Q. Gò Vấp, TP.HCM' },
        },
        {
            email: 'customer@gmail.com',
            phone_number: '0987654324',
            first_name: 'Nguyễn Văn',
            last_name: 'Khách',
            role: Role.CUSTOMER,
            detail: { birthday: new Date('1998-12-20'), sex: 'male', avatar_url: 'https://i.pravatar.cc/150?u=customer', address: 'Q.1, TP.HCM' },
        },
    ];

    // 3.2: Sinh thêm 22 User ngẫu nhiên (Customer)
    for (let i = 1; i <= 300; i++) {
        // Tạo 7 số cuối, pad cho đủ 7 số
        const suffix = i.toString().padStart(7, '0');
        const phone = `098${suffix}`; // 098 + 7 số = 10 số

        usersData.push({
            email: `user${i}@test.com`,
            phone_number: phone,
            first_name: 'Customer',
            last_name: `Number ${i}`,
            role: 'CUSTOMER',
            detail: {
                birthday: new Date('1999-01-01'),
                sex: i % 2 === 0 ? 'male' : 'female',
                avatar_url: `https://i.pravatar.cc/150?u=${i}`,
                address: `Số ${i} Đường Demo, TP.HCM`,
            },
        });
    }


    // ==========================================================
    // 4. CREATE USERS
    // ==========================================================
    Logger.log(`⏳ Creating ${usersData.length} users...`);

    for (const u of usersData) {

        await prisma.user.create({
            data: {
                email: u.email,
                phone_number: u.phone_number,
                hash: commonHash, // Dùng hash đã tạo sẵn
                first_name: u.first_name,
                last_name: u.last_name,
                is_locked: false,

                // Connect Role
                roles: {
                    connectOrCreate: {
                        where: { role_name: u.role.toLowerCase() }, // dùng viết thường để thống nhất với DB
                        create: { role_name: u.role.toLowerCase() },
                    },
                },

                // Create UserDetail
                detail: {
                    create: {
                        birthday: u.detail.birthday,
                        sex: u.detail.sex,
                        avatar_url: u.detail.avatar_url,
                        address: u.detail.address,
                    },
                },
            },
        });
    }

    Logger.log(`✅ Seeded ${usersData.length} Users successfully`);
    return prisma.user.findMany({ include: { roles: true } });
}