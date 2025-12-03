import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedUserAddresses() {
    Logger.log('🪄 Seeding User Addresses...');

    // 1. CHECK TỒN TẠI
    const count = await prisma.userAddress.count();
    if (count > 0) {
        Logger.log('⚠️ User Addresses already exist → Skip');
        return prisma.userAddress.findMany();
    }

    // 2. LẤY DANH SÁCH USER (Để có userId hợp lệ)
    const users = await prisma.user.findMany();

    if (users.length === 0) {
        Logger.warn('⚠️ No Users found! Please seed Users before seeding Addresses.');
        return [];
    }

    // 3. SAMPLE DATA (Địa chỉ Việt Nam thực tế)
    const sampleAddresses = [
        '123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
        '45 Đường Cầu Giấy, Phường Quan Hoa, Quận Cầu Giấy, Hà Nội',
        '99 Đường Bạch Đằng, Quận Hải Châu, TP. Đà Nẵng',
        '1 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP. Hồ Chí Minh',
        '12 Đường 3/2, Phường Xuân Khánh, Quận Ninh Kiều, Cần Thơ',
        '88 Đường Lê Văn Sỹ, Phường 14, Quận 3, TP. Hồ Chí Minh',
        'Số 1 Đại Cồ Việt, Quận Hai Bà Trưng, Hà Nội',
        'Khu Đô Thị Phú Mỹ Hưng, Quận 7, TP. Hồ Chí Minh',
        'Đường Hùng Vương, Phường 1, TP. Sa Đéc, Đồng Tháp',
        'Đường Trần Phú, TP. Nha Trang, Khánh Hòa',
    ];

    // 4. MAP DATA
    const addressData = users.map((user, index) => {
        // Lấy địa chỉ theo vòng lặp (nếu user nhiều hơn mẫu)
        const addressString = sampleAddresses[index % sampleAddresses.length];

        // Tên hiển thị đầy đủ
        const fullName = `${user.first_name} ${user.last_name}`.trim() || 'Customer';

        return {
            userId: user.id,
            recipientName: fullName,        // Người nhận là chủ tài khoản
            phoneNumber: user.phone_number, // Số điện thoại lấy từ tài khoản
            fullAddress: addressString,
            isDefault: true,                // Set mặc định là địa chỉ chính
        };
    });

    // 5. CREATE
    await prisma.userAddress.createMany({
        data: addressData,
    });

    Logger.log(`✅ Seeded Addresses for ${addressData.length} users`);
    return prisma.userAddress.findMany();
}