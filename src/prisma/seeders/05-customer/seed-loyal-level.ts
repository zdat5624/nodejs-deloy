import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedLoyalLevels() {
    Logger.log('🪄 Seeding Loyal Levels...');

    // 1. CHECK TỒN TẠI
    const count = await prisma.loyalLevel.count();
    if (count > 0) {
        Logger.log('⚠️ Loyal Levels already exist → Skip');
        return prisma.loyalLevel.findMany();
    }

    // 2. DATA
    // Giả định: 1 Point = 10,000 VND chi tiêu (hoặc tùy chính sách quán)
    const levels = [
        { name: 'Bronze', required_points: 0 },      // Cấp độ mặc định
        { name: 'Silver', required_points: 100 },    // ~ 1 triệu VND
        { name: 'Gold', required_points: 500 },    // ~ 5 triệu VND
        { name: 'Diamond', required_points: 600 },     // ~ 10 triệu VND
    ];

    // 3. CREATE
    await prisma.loyalLevel.createMany({
        data: levels,
    });

    Logger.log(`✅ Seeded ${levels.length} Loyal Levels`);
    return prisma.loyalLevel.findMany();
}