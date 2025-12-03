import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedRoles() {
    Logger.log('🪄 Seeding roles...');

    // 1. CHECK TỒN TẠI
    const existing = await prisma.role.count();
    if (existing > 0) {
        Logger.log('⚠️ Roles already exist → Skip seeding');
        return prisma.role.findMany();
    }

    // 2. DATA MẶC ĐỊNH
    const roles = [
        { role_name: 'owner' },
        { role_name: 'manager' },
        { role_name: 'staff' },
        { role_name: 'barista' },
        { role_name: 'baker' },
        { role_name: 'customer' },
        { role_name: 'stocktaker' },
        { role_name: 'cashier' },
    ];

    // 3. UPSERT (nếu bạn muốn chắc chắn)
    for (const role of roles) {
        await prisma.role.upsert({
            where: { role_name: role.role_name },
            update: {},
            create: role,
        });
    }

    Logger.log('✅ Seeded roles');
    return prisma.role.findMany();
}
