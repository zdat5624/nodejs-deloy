import { Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Helper tạo key tra cứu: "YYYY-MM-DD_materialId"
const getKey = (date: Date, matId: number) => {
    return `${date.toISOString().split('T')[0]}_${matId}`;
};

export async function seedMaterialRemain() {
    Logger.log('🪄 Seeding Material Remain (Last 30 Days Snapshot)...');

    // 1. CHECK TỒN TẠI
    const count = await prisma.materialRemain.count();
    if (count > 0) {
        Logger.log('⚠️ Material Remain data already exists → Skip');
        return;
    }

    // 2. LOAD DỮ LIỆU
    const materials = await prisma.material.findMany({
        include: { Unit: true },
    });

    if (materials.length === 0) {
        Logger.error('❌ No Materials found.');
        return;
    }

    const importations = await prisma.materialImportation.findMany();

    // Map import để tra cứu nhanh
    const importMap = new Map<string, number>();
    for (const imp of importations) {
        const key = getKey(imp.importDate, imp.materialId);
        const currentQty = importMap.get(key) || 0;
        importMap.set(key, currentQty + imp.importQuantity);
    }

    // 3. THIẾT LẬP THỜI GIAN (1 Tháng gần nhất)
    const today = new Date();

    // Kết thúc: Hôm qua
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - 1);

    // Bắt đầu: 30 ngày trước
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);

    Logger.log(`   Time range: ${startDate.toISOString().split('T')[0]} -> ${endDate.toISOString().split('T')[0]}`);

    // 4. KHỞI TẠO TỒN ĐẦU KỲ (Quan trọng)
    // Vì ta không chạy từ 2 năm trước, nên phải giả định lúc bắt đầu (30 ngày trước) 
    // trong kho đã có sẵn hàng (Opening Stock) để trừ dần.
    const currentStock = new Map<number, number>();
    for (const mat of materials) {
        // Random tồn đầu: 50 - 200 đơn vị tùy loại
        let openingStock = 0;
        switch (mat.Unit.symbol) {
            case 'kg': openingStock = Math.random() * 50 + 20; break; // 20-70kg
            case 'l': openingStock = Math.random() * 50 + 20; break;  // 20-70l
            case 'pcs': openingStock = Math.floor(Math.random() * 500) + 200; break; // 200-700 cái
            default: openingStock = 50;
        }
        currentStock.set(mat.id, openingStock);
    }

    // 5. VÒNG LẶP TẠO DỮ LIỆU
    const remainsData: Prisma.materialRemainCreateManyInput[] = [];

    // Loop từng ngày từ Start -> End
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateSnapshot = new Date(d);

        for (const mat of materials) {
            const matId = mat.id;
            let stock = currentStock.get(matId) || 0;

            // A. CỘNG NHẬP (Import)
            const importKey = getKey(dateSnapshot, matId);
            const importQty = importMap.get(importKey) || 0;
            stock += importQty;

            // B. TRỪ BÁN (Usage - Giả lập)
            if (stock > 0) {
                let usage = 0;
                switch (mat.Unit.symbol) {
                    case 'kg': usage = Math.random() * 1.5 + 0.5; break; // Dùng 0.5 - 2kg
                    case 'l': usage = Math.random() * 3 + 2; break;      // Dùng 2 - 5l
                    case 'pcs': usage = Math.floor(Math.random() * 100) + 50; break; // Dùng 50 - 150 cái
                    default: usage = 1;
                }

                // Không trừ âm kho
                if (usage > stock) usage = stock;
                stock -= usage;
            }

            // Làm tròn 2 số thập phân
            stock = Math.round(stock * 100) / 100;

            // C. UPDATE & PUSH
            currentStock.set(matId, stock);

            remainsData.push({
                materialId: matId,
                remain: stock,
                date: dateSnapshot,
            });
        }
    }

    // 6. GHI VÀO DB
    Logger.log(`   Inserting ${remainsData.length} records...`);
    await prisma.materialRemain.createMany({ data: remainsData });

    Logger.log(`✅ Seeded Material Remain successfully`);
}