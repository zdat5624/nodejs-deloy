import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedCategories() {
    Logger.log('🪄 Seeding Categories...');

    // 1. CHECK EXISTENCE
    const count = await prisma.category.count();
    if (count > 0) {
        Logger.log('⚠️ Categories already exist → Skip');
        return prisma.category.findMany({ include: { subcategories: true } });
    }

    // 2. DATA (Parent - Child Structure)
    const categoriesData = [
        {
            name: 'Coffee',
            subcategories: [
                'Espresso',
                'Americano',
                'Latte',
                'Frappe',
                'Vietnamese Phin Coffee',
                'Cold Brew',
            ],
        },
        {
            name: 'Tea',
            subcategories: [
                'Northwest Matcha',
                'Kyoto Matcha',
                'Fruit Tea',
                'Milk Tea',
                'Chocolate',
            ],
        },
        {
            name: 'Food', // Đồ ăn
            subcategories: [
                'Sweet Pastries',   // Bánh ngọt
                'Savory Pastries',  // Bánh mặn
            ],
        },
        {
            name: 'Topping', // Topping đứng 1 mình, không cần subcategories
            subcategories: [], // <--- ĐỂ TRỐNG
        },
    ];

    // 3. CREATE
    let parentSortIndex = 1;

    for (const parentGroup of categoriesData) {
        // Create Parent Category
        const parentCategory = await prisma.category.create({
            data: {
                name: parentGroup.name,
                sort_index: parentSortIndex++,
                is_parent_category: true, // Mark as parent
            },
        });

        // Create Child Categories (Only if subcategories exist)
        if (parentGroup.subcategories.length > 0) {
            const subData = parentGroup.subcategories.map((subName, index) => ({
                name: subName,
                sort_index: index + 1,
                is_parent_category: false,
                parent_category_id: parentCategory.id, // Link to Parent
            }));

            await prisma.category.createMany({
                data: subData,
            });
        }
    }

    Logger.log(`✅ Seeded ${categoriesData.length} Parent Categories`);

    // Return data for verification
    return prisma.category.findMany({
        where: { parent_category_id: null },
        include: { subcategories: true },
    });
}