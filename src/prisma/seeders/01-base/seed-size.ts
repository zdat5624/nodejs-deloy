import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedSizes() {
    Logger.log('🪄 Seeding Sizes...');

    // 1. CHECK TỒN TẠI
    const count = await prisma.size.count();
    if (count > 0) {
        Logger.log('⚠️ Sizes already exist → Skip');
        return prisma.size.findMany();
    }

    // 2. DATA
    const data = [
        { name: 'S', sort_index: 1 }, // Small
        { name: 'M', sort_index: 2 }, // Medium
        { name: 'L', sort_index: 3 }, // Large
    ];

    // 3. CREATE
    for (const size of data) {
        await prisma.size.create({
            data: {
                name: size.name,
                sort_index: size.sort_index,
            },
        });
    }

    Logger.log('✅ Seeded Sizes');
    return prisma.size.findMany();
}