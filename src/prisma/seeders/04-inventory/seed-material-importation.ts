import { Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedMaterialImportations() {
    Logger.log('🪄 Seeding Material Importations (Last 3 Years)...');

    // ... (Giữ nguyên phần check tồn tại và lấy Employee) ...
    const count = await prisma.materialImportation.count();
    if (count > 0) return prisma.materialImportation.findMany();

    const employee = await prisma.user.findFirst(); // (Rút gọn cho ngắn)

    // 1. SỬA: Lấy Material kèm Unit để biết nó là cái gì (kg hay cái)
    const materials = await prisma.material.findMany({
        include: { Unit: true }
    });

    const importationsData: Prisma.MaterialImportationCreateManyInput[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const startYear = currentYear - 2;

    for (let year = startYear; year <= currentYear; year++) {
        const endMonth = (year === currentYear) ? now.getMonth() : 11;

        for (let month = 0; month <= endMonth; month++) {
            let importDate = new Date(year, month, 15, 8, 0, 0);
            if (importDate > now) {
                // Tạo một bản sao của 'now' để không ảnh hưởng biến gốc
                const yesterday = new Date(now);

                // Lùi lại 1 ngày
                yesterday.setDate(yesterday.getDate() - 1);

                // Gán vào ngày nhập
                importDate = yesterday;
            }

            for (const mat of materials) {
                let qty = 0;
                let basePrice = 0;

                // 2. SỬA: Logic giá và số lượng dựa theo Đơn Vị (Symbol)
                switch (mat.Unit.symbol) {
                    case 'kg': // Cafe, Trà, Bột (Giá cao, nhập số lượng vừa)
                        qty = Math.floor(Math.random() * 40) + 10; // 10 - 50 kg
                        basePrice = 150000; // ~150k/kg trung bình
                        break;

                    case 'l': // Sữa tươi, Syrup (Giá trung bình)
                        qty = Math.floor(Math.random() * 50) + 20; // 20 - 70 lít
                        basePrice = 40000; // ~40k/lít
                        break;

                    case 'can': // Sữa đặc (Giá rẻ hơn xíu)
                    case 'btl': // Chai syrup
                        qty = Math.floor(Math.random() * 50) + 20;
                        basePrice = 30000;
                        break;

                    case 'pcs': // Ly, Ống hút (Giá siêu rẻ, nhập số lượng lớn)
                        qty = Math.floor(Math.random() * 500) + 500; // 500 - 1000 cái
                        basePrice = 1500; // ~1.5k/cái (Tính trung bình ly + nắp)
                        break;

                    case 'box': // Hộp
                    case 'pack': // Gói
                        qty = Math.floor(Math.random() * 20) + 5;
                        basePrice = 45000;
                        break;

                    default: // Đơn vị lạ
                        qty = 50;
                        basePrice = 50000;
                }

                // Thêm biến động giá 10%
                const variance = Math.floor(Math.random() * (basePrice * 0.2)) - (basePrice * 0.1);
                const finalPrice = Math.floor(basePrice + variance);

                const expiryDate = new Date(importDate);
                expiryDate.setMonth(expiryDate.getMonth() + 6);

                importationsData.push({
                    materialId: mat.id,
                    employeeId: employee?.id || 1,
                    importQuantity: qty,
                    pricePerUnit: finalPrice,
                    importDate: importDate,
                    expiryDate: expiryDate,
                    isRecorded: true,
                });
            }
        }
    }

    Logger.log(`   Preparing to insert ${importationsData.length} importation records...`);
    await prisma.materialImportation.createMany({ data: importationsData });
    Logger.log(`✅ Seeded Material Importations successfully`);
    return [];
}