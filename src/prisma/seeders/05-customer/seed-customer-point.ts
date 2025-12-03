import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedCustomerPoints() {
    Logger.log('🪄 Seeding Customer Points & Levels...');

    // 1. CHECK TỒN TẠI
    const count = await prisma.customerPoint.count();
    if (count > 0) {
        Logger.log('⚠️ Customer Points already exist → Skip');
        return prisma.customerPoint.findMany();
    }

    // 2. LẤY DỮ LIỆU PHỤ THUỘC
    // a. Lấy danh sách Level, sắp xếp từ cao xuống thấp để dễ tính toán
    // VD: Diamond (1000) -> Gold (600) -> ... -> Member (0)
    const levels = await prisma.loyalLevel.findMany({
        orderBy: { required_points: 'desc' },
    });

    if (levels.length === 0) {
        Logger.error('❌ No Loyal Levels found. Please seed LoyalLevel first.');
        return [];
    }

    // b. Lấy danh sách khách hàng (User có role là 'customer')
    // Lưu ý: Cần đảm bảo seedUsers đã chạy và role_name trong DB khớp với query này
    const customers = await prisma.user.findMany();

    if (customers.length === 0) {
        Logger.warn('⚠️ No Customers found to assign points.');
        return [];
    }

    // 3. TẠO DỮ LIỆU
    const pointsData = customers.map((customer) => {
        // Random điểm từ 0 đến 1200
        // Member (0), Bronze(100), Silver(300), Gold(600), Diamond(1000)
        const randomPoints = Math.floor(Math.random() * 1500);

        // Logic tìm Level dựa trên điểm
        // Vì đã sort desc, level đầu tiên thỏa mãn (points >= required) chính là level hiện tại
        const currentLevel = levels.find((lvl) => randomPoints >= lvl.required_points);

        return {
            customerPhone: customer.phone_number,
            points: randomPoints,
            loyalLevelId: currentLevel ? currentLevel.id : levels[levels.length - 1].id, // Fallback về level thấp nhất
        };
    });

    // 4. INSERT
    await prisma.customerPoint.createMany({
        data: pointsData,
    });

    Logger.log(`✅ Seeded Points for ${pointsData.length} customers`);
    return prisma.customerPoint.findMany();
}