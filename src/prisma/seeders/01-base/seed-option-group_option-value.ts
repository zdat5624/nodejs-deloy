import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedOptionGroups() {
    Logger.log('🪄 Seeding Option Groups...');

    // 1. CHECK TỒN TẠI
    const count = await prisma.optionGroup.count();
    if (count > 0) {
        Logger.log('⚠️ Option Groups already exist → Skip');
        return prisma.optionGroup.findMany({
            include: { values: true },
        });
    }

    // 2. DATA
    const data = [
        {
            name: 'Sugar Level',
            values: [
                { name: 'No Sugar', sort_index: 1 },     // Ít
                { name: 'Less Sugar', sort_index: 2 },     // Ít
                { name: 'Standard Sugar', sort_index: 3 }, // Vừa
                { name: 'Extra Sugar', sort_index: 4 },    // Nhiều
            ],
        },
        {
            name: 'Ice Level',
            values: [
                { name: 'No Ice', sort_index: 1 },
                { name: 'Less Ice', sort_index: 2 },     // Ít đá
                { name: 'Standard Ice', sort_index: 3 }, // Vừa đá
                { name: 'Extra Ice', sort_index: 4 },    // Nhiều đá
            ],
        },
        {
            name: 'Tea Level',
            values: [
                { name: 'Light Tea', sort_index: 1 },    // Nhạt
                { name: 'Standard Tea', sort_index: 2 }, // Vừa
                { name: 'Strong Tea', sort_index: 3 },   // Đậm
            ],
        },
    ];

    // 3. CREATE
    for (const group of data) {
        await prisma.optionGroup.create({
            data: {
                name: group.name,
                values: {
                    create: group.values.map((val) => ({
                        name: val.name,
                        sort_index: val.sort_index,
                    })),
                },
            },
        });
    }

    Logger.log('✅ Seeded Option Groups');
    return prisma.optionGroup.findMany({
        include: { values: true },
    });
}