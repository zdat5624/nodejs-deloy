import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ENUM Payment Method (Như bạn cung cấp)
export enum PaymentMethodEnum {
    CASH = 'cash',
    VNPAY = 'vnpay',
}

export async function seedPaymentMethods() {
    Logger.log('🪄 Seeding Payment Methods...');

    // 1. CHECK TỒN TẠI
    const count = await prisma.paymentMethod.count();
    if (count > 0) {
        Logger.log('⚠️ Payment Methods already exist → Skip');
        return prisma.paymentMethod.findMany();
    }

    // 2. DATA
    const paymentMethodsData = [
        { name: PaymentMethodEnum.CASH, is_active: true },
        { name: PaymentMethodEnum.VNPAY, is_active: true },
    ];

    // 3. CREATE
    for (const method of paymentMethodsData) {
        await prisma.paymentMethod.create({
            data: {
                name: method.name,
                is_active: method.is_active,
                created_at: new Date(), // Thời điểm tạo
            },
        });
    }

    Logger.log(`✅ Seeded ${paymentMethodsData.length} Payment Methods`);
    return prisma.paymentMethod.findMany();
}