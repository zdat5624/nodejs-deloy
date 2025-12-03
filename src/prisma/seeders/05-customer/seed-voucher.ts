import { Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import * as voucher_codes from 'voucher-code-generator';

const prisma = new PrismaClient();

// 1. ĐỊNH NGHĨA KIỂU DỮ LIỆU ĐỂ TRÁNH LỖI TS
interface VoucherScenario {
    name: string;
    prefix: string;
    discount: number;
    min: number;
    qty: number;
    cost?: number; // <--- Dấu ? nghĩa là có thể có hoặc không (Optional)
    isExpired?: boolean;
}

// --- HELPER FUNCTIONS ---
async function generateUniqueGroupName(prefix: string): Promise<string> {
    let groupName: string;
    let isUnique = false;
    do {
        const date = new Date();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        groupName = `${prefix.toUpperCase()}_${y}${m}${d}_${random}`;

        const exists = await prisma.voucher.findFirst({ where: { group_name: groupName } });
        isUnique = !exists;
    } while (!isUnique);
    return groupName;
}

async function generateUniqueVoucherCode(prefix: string): Promise<string> {
    let code: string;
    let isUnique = false;
    do {
        code = voucher_codes.generate({
            length: 6,
            count: 1,
            charset: 'alphanumeric',
            prefix: prefix + '-',
            postfix: '',
            pattern: '####-####',
        })[0];
        const exists = await prisma.voucher.findUnique({ where: { code } });
        isUnique = !exists;
    } while (!isUnique);
    return code;
}

// --- MAIN SEED FUNCTION ---
export async function seedVouchers() {
    Logger.log('🪄 Seeding 21 Voucher Groups (Creative Names)...');

    // 1. CHECK EXISTENCE
    const count = await prisma.voucher.count();
    if (count > 0) {
        Logger.log('⚠️ Vouchers already exist → Skip');
        return prisma.voucher.findMany();
    }

    // 2. DEFINE SCENARIOS (Gán kiểu VoucherScenario[])

    // --- A. EXPIRED VOUCHERS ---
    const expiredScenarios: VoucherScenario[] = [
        { name: 'Hello Summer 2024', prefix: 'SUMMER', discount: 20, min: 50000, qty: 10 },
        { name: 'Back To School Special', prefix: 'SCHOOL', discount: 15, min: 30000, qty: 10 },
        { name: 'Mid-Autumn Festival', prefix: 'MOON', discount: 25, min: 100000, qty: 5 },
        { name: 'Halloween Spooky Deal', prefix: 'SPOOKY', discount: 30, min: 60000, qty: 10 },
        { name: 'Black Friday Sale', prefix: 'BLACK', discount: 50, min: 200000, qty: 5 },
    ];

    // --- B. ACTIVE VOUCHERS ---
    const activeScenarios: VoucherScenario[] = [
        // Welcome
        { name: 'First Sip', prefix: 'HELLO', discount: 100, min: 0, qty: 20 },
        { name: 'New Member Gift', prefix: 'NEWBIE', discount: 20, min: 0, qty: 50 },

        // Time
        { name: 'Morning Energy Boost', prefix: 'MORNING', discount: 15, min: 40000, qty: 50 },
        { name: 'Lunch Break Saver', prefix: 'LUNCH', discount: 10, min: 50000, qty: 50 },
        { name: 'Happy Hour', prefix: 'HAPPY', discount: 30, min: 100000, qty: 50 },

        // Product
        { name: 'Espresso Yourself', prefix: 'COFFEE', discount: 15, min: 40000, qty: 50 },
        { name: 'Tea Time Treasure', prefix: 'TEA', discount: 15, min: 45000, qty: 50 },
        { name: 'Sweet Tooth Treat', prefix: 'CAKE', discount: 10, min: 35000, qty: 50 },

        // Lifestyle
        { name: 'Rainy Day Comfort', prefix: 'RAINY', discount: 20, min: 60000, qty: 40 },
        { name: 'Work From Shop', prefix: 'WORK', discount: 10, min: 80000, qty: 50 },
        { name: 'Weekend Chill Vibes', prefix: 'WEEKEND', discount: 15, min: 100000, qty: 40 },

        // High Volume
        { name: 'Buy 1 Get 1 Free', prefix: 'BOGO', discount: 50, min: 60000, qty: 55 },
        { name: 'Office Party Pack', prefix: 'OFFICE', discount: 25, min: 300000, qty: 44 },
        { name: 'Free Upsize', prefix: 'SIZEUP', discount: 10, min: 0, qty: 44 },

        // Loyalty (Có field COST)
        { name: 'Gold Member Exclusive', prefix: 'GOLD', discount: 40, min: 0, qty: 10, cost: 500 },
        { name: 'Birthday Gift', prefix: 'HPBD', discount: 50, min: 0, qty: 77 },
    ];

    // 3. EXECUTE LOOP
    // Gán kiểu cho mảng tổng hợp để TS hiểu
    const allScenarios: VoucherScenario[] = [
        ...expiredScenarios.map(s => ({ ...s, isExpired: true })),
        ...activeScenarios.map(s => ({ ...s, isExpired: false }))
    ];

    for (const s of allScenarios) {
        const groupName = await generateUniqueGroupName(s.prefix);

        // Logic ngày tháng
        const today = new Date();
        let validFrom: Date;
        let validTo: Date;
        let isActive: boolean;

        if (s.isExpired) {
            validFrom = new Date();
            validFrom.setMonth(validFrom.getMonth() - 3);
            validTo = new Date();
            validTo.setMonth(validTo.getMonth() - 1);
            isActive = false;
        } else {
            validFrom = new Date();
            validTo = new Date();
            validTo.setDate(validTo.getDate() + 30);
            isActive = true;
        }

        Logger.log(`   Generating Group: ${s.name} (${s.isExpired ? 'EXPIRED' : 'ACTIVE'})`);

        const vouchersBatch: Prisma.VoucherCreateManyInput[] = [];

        for (let i = 0; i < s.qty; i++) {
            const code = await generateUniqueVoucherCode(s.prefix);
            vouchersBatch.push({
                voucher_name: s.name,
                code: code,
                group_name: groupName,
                discount_percentage: s.discount,
                minAmountOrder: s.min,

                // Fix lỗi ở đây: Nếu s.cost undefined thì lấy 0
                requirePoint: s.cost || 0,

                valid_from: validFrom,
                valid_to: validTo,
                is_active: isActive,
                customerPhone: null,
            });
        }

        await prisma.voucher.createMany({
            data: vouchersBatch
        });
    }

    // 4. ASSIGN VOUCHERS TO CUSTOMER (Simulation)
    const customer = await prisma.user.findFirst();

    if (customer) {
        Logger.log(`   Assigning sample vouchers to customer ${customer.phone_number}...`);

        const targetVoucherNames = ['First Sip', 'Happy Hour', 'Buy 1 Get 1 Free'];

        for (const vName of targetVoucherNames) {
            const voucher = await prisma.voucher.findFirst({
                where: {
                    voucher_name: vName,
                    is_active: true,
                    customerPhone: null
                }
            });

            if (voucher) {
                // Logic: Check voucher trong group này user đã có chưa
                const existingInGroup = await prisma.voucher.findFirst({
                    where: {
                        customerPhone: customer.phone_number,
                        group_name: voucher.group_name
                    }
                });

                if (!existingInGroup) {
                    await prisma.voucher.update({
                        where: { id: voucher.id },
                        data: { customerPhone: customer.phone_number }
                    });
                    Logger.log(`      + Assigned '${vName}' to customer.`);
                } else {
                    Logger.warn(`      ! Customer already has a voucher in group '${voucher.group_name}'. Skip.`);
                }
            }
        }
    }

    Logger.log(`✅ Seeded ${allScenarios.length} Voucher Groups successfully`);
    return prisma.voucher.findMany();
}