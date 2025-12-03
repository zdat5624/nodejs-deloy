import { Logger } from '@nestjs/common';
import { PrismaClient, Prisma, User, Product, PaymentMethod, UserAddress, ProductSize, Size } from '@prisma/client';

const prisma = new PrismaClient();

enum OrderStatus {
    PENDING = 'pending',
    PAID = 'paid',
    SHIPPING = 'shipping',
    COMPLETED = 'completed',
    CANCELED = 'canceled',
}

enum OrderType {
    POS = 'POS',
    ONLINE = 'ONLINE'
}

// --- HELPER DATA ---
const districts = [
    'District 1', 'District 3', 'District 4', 'District 5', 'District 7',
    'Binh Thanh', 'Phu Nhuan', 'Tan Binh', 'Thu Duc'
];
const streets = [
    'Nguyen Hue', 'Le Loi', 'Hai Ba Trung', 'Dien Bien Phu',
    'Vo Van Kiet', 'Nguyen Trai', 'Le Van Sy', 'Hoang Sa'
];
const getWard = () => `Ward ${Math.floor(Math.random() * 15) + 1}`;

// Helper functions
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// --- TYPES FOR CONTEXT ---
type CustomerWithAddresses = User & { addresses: UserAddress[] };
type ProductWithSizes = Product & { sizes: (ProductSize & { size: Size })[] };

interface SeedContext {
    customers: CustomerWithAddresses[];
    staffs: User[];
    mainProducts: ProductWithSizes[];
    toppings: Product[];
    cashMethod: PaymentMethod | undefined;
    vnpayMethod: PaymentMethod | undefined;
}

// --- MAIN SEED FUNCTION ---
export async function seedOrders() {
    Logger.log('🪄 Seeding Orders (Strategic History & Current)...');

    // Check data
    const count = await prisma.order.count();
    if (count > 200) {
        Logger.log('⚠️ Orders already exist (>200 records) → Skip');
        return;
    }

    // 1. LOAD MASTER DATA
    const customers = await prisma.user.findMany({
        include: { addresses: true }
    });
    const staffs = await prisma.user.findMany({
        where: { roles: { some: { role_name: { in: ['staff', 'manager', 'admin', 'stocktaker'] } } } }
    });
    const paymentMethods = await prisma.paymentMethod.findMany();
    const cashMethod = paymentMethods.find(p => p.name.toLowerCase() === 'cash');
    const vnpayMethod = paymentMethods.find(p => p.name.toLowerCase() === 'vnpay');

    const mainProducts = await prisma.product.findMany({
        where: { isTopping: false, isActive: true },
        include: { sizes: { include: { size: true } } },
    });
    const toppings = await prisma.product.findMany({
        where: { isTopping: true, isActive: true },
    });

    if (customers.length === 0 || mainProducts.length === 0) {
        Logger.error('❌ Missing Customers or Products.');
        return;
    }

    // Context Object typed explicitly
    const context: SeedContext = {
        customers, staffs, mainProducts, toppings, cashMethod, vnpayMethod
    };

    const today = new Date();
    const currentYear = today.getFullYear();
    let totalOrdersCreated = 0;

    // Xác định mốc thời gian chuyển giao giữa Monthly và Daily
    const currentMonthIndex = today.getMonth(); // 0-11
    const startDailyMonthIndex = Math.max(0, currentMonthIndex - 1); // Lấy tối đa 2 tháng gần nhất
    const startDailyDate = new Date(currentYear, startDailyMonthIndex, 1);

    // =================================================================
    // GIAI ĐOẠN 1: DỮ LIỆU LỊCH SỬ (Generate theo Tháng)
    // =================================================================
    const historyYears = [currentYear - 2, currentYear - 1, currentYear];

    Logger.log(`📅 Phase 1: Generating History (Monthly Batch)`);

    for (const year of historyYears) {
        // Nếu là năm hiện tại, chỉ chạy đến trước tháng bắt đầu Daily
        const endMonth = (year === currentYear) ? startDailyMonthIndex : 12;

        if (year === currentYear) {
            Logger.log(`   -> Current Year ${year}: Filling months 0 to ${endMonth - 1} with monthly batch...`);
        }

        for (let month = 0; month < endMonth; month++) {
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            // Số lượng đơn mỗi tháng: 600 - 900 đơn
            const monthlyOrderCount = randomInt(600, 900);

            Logger.log(`   -> Month ${month + 1}/${year}: Creating ${monthlyOrderCount} orders...`);

            for (let i = 0; i < monthlyOrderCount; i++) {
                // Random ngày trong tháng
                const day = randomInt(1, daysInMonth);
                const orderDate = new Date(year, month, day);
                // Random giờ hoạt động (7h - 22h)
                orderDate.setHours(randomInt(7, 22), randomInt(0, 59), 0);

                await createSingleOrder(prisma, orderDate, context, false);
                totalOrdersCreated++;
            }
        }
    }

    // =================================================================
    // GIAI ĐOẠN 2: DỮ LIỆU GẦN ĐÂY (Generate theo Ngày)
    // =================================================================
    Logger.log(`📅 Phase 2: Generating Recent Data (Daily Detailed) from ${startDailyDate.toISOString().split('T')[0]}`);

    for (let d = new Date(startDailyDate); d <= today; d.setDate(d.getDate() + 1)) {
        const isToday = d.toDateString() === today.toDateString();

        // Logic số lượng đơn chi tiết
        const dayOfWeek = d.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const dailyOrderCount = isWeekend ? randomInt(50, 75) : randomInt(24, 44);

        Logger.log(`   -> Processing ${d.toISOString().split('T')[0]}: ${dailyOrderCount} orders`);

        for (let i = 0; i < dailyOrderCount; i++) {
            const orderDate = new Date(d);
            orderDate.setHours(randomInt(7, 22), randomInt(0, 59), 0);

            if (isToday && orderDate > new Date()) continue; // Không tạo đơn tương lai

            await createSingleOrder(prisma, orderDate, context, isToday);
            totalOrdersCreated++;
        }
    }

    Logger.log(`✅ Seeded Total ${totalOrdersCreated} Orders successfully.`);
}

// --- HELPER: HÀM TẠO 1 ĐƠN HÀNG (DÙNG CHUNG) ---
async function createSingleOrder(
    prisma: PrismaClient,
    orderDate: Date,
    ctx: SeedContext,
    isToday: boolean
) {
    const { customers, staffs, mainProducts, toppings, cashMethod, vnpayMethod } = ctx;

    const customer = randomElement(customers);
    const staff = randomElement(staffs);
    const orderType = Math.random() < 0.7 ? OrderType.POS : OrderType.ONLINE;

    // 1. Determine Status
    let status: OrderStatus;
    if (isToday) {
        const rand = Math.random();
        if (orderType === OrderType.ONLINE) {
            if (rand < 0.2) status = OrderStatus.PENDING;
            else if (rand < 0.4) status = OrderStatus.PAID;
            else if (rand < 0.7) status = OrderStatus.SHIPPING;
            else status = OrderStatus.COMPLETED;
        } else {
            status = rand < 0.1 ? OrderStatus.PENDING : OrderStatus.COMPLETED;
        }
    } else {
        status = Math.random() < 0.95 ? OrderStatus.COMPLETED : OrderStatus.CANCELED;
    }

    // 2. Shipping Address Logic
    let shippingAddressString: string | null = null;
    if (orderType === OrderType.ONLINE) {
        if (customer.addresses && customer.addresses.length > 0) {
            // ✅ Ưu tiên 1: Dùng địa chỉ thật của User
            const userAddr = randomElement(customer.addresses);
            shippingAddressString = `${userAddr.recipientName} (${userAddr.phoneNumber}) - ${userAddr.fullAddress}`;
        } else {
            // ⚠️ Fallback: Fake địa chỉ nếu User chưa có
            const fakeStreet = `${randomInt(1, 999)} ${randomElement(streets)} St`;
            const fakeWard = getWard();
            const fakeDistrict = randomElement(districts);
            const fakeFull = `${fakeStreet}, ${fakeWard}, ${fakeDistrict}, Ho Chi Minh City`;
            const fakeName = (customer.first_name || '') + ' ' + (customer.last_name || '');

            shippingAddressString = `${fakeName.trim() || 'Customer'} (${customer.phone_number}) - ${fakeFull}`;
        }
    }

    // 3. Build Items
    const itemCount = randomInt(1, 4);
    const orderDetailsData: Prisma.OrderDetailCreateWithoutOrderInput[] = [];
    let originalPrice = 0;

    for (let k = 0; k < itemCount; k++) {
        const product = randomElement(mainProducts);
        let productSizeId: number | null = null;
        let unitPrice = product.price || 0;

        // Random Size
        if (product.is_multi_size && product.sizes.length > 0) {
            const chosenSize = randomElement(product.sizes);
            productSizeId = chosenSize.size_id;
            unitPrice = chosenSize.price;
        }

        // Random Topping
        const itemToppings: { topping_id: number; quantity: number; unit_price: number }[] = [];
        let toppingPriceTotal = 0;

        if (Math.random() < 0.3 && toppings.length > 0) {
            const toppingQty = randomInt(1, 2);
            for (let t = 0; t < toppingQty; t++) {
                const tProd = randomElement(toppings);
                itemToppings.push({
                    topping_id: tProd.id,
                    quantity: 1,
                    unit_price: tProd.price || 0
                });
                toppingPriceTotal += (tProd.price || 0);
            }
        }

        const quantity = randomInt(1, 2);
        const lineTotal = (unitPrice + toppingPriceTotal) * quantity;
        originalPrice += lineTotal;

        orderDetailsData.push({
            product: { connect: { id: product.id } },
            size: productSizeId ? { connect: { id: productSizeId } } : undefined,
            quantity: quantity,
            unit_price: unitPrice,
            product_name: product.name,
            ToppingOrderDetail: itemToppings.length > 0 ? {
                create: itemToppings.map(t => ({
                    topping: { connect: { id: t.topping_id } },
                    quantity: t.quantity,
                    unit_price: t.unit_price
                }))
            } : undefined
        });
    }

    // 4. Payment
    let paymentDetailCreate: Prisma.PaymentDetailCreateNestedOneWithoutOrderInput | undefined = undefined;
    const isPaidStatus = [OrderStatus.PAID, OrderStatus.SHIPPING, OrderStatus.COMPLETED].includes(status);

    if (isPaidStatus) {
        let chosenMethodId = cashMethod?.id;
        if (orderType === OrderType.ONLINE) {
            chosenMethodId = vnpayMethod?.id;
        } else {
            chosenMethodId = Math.random() > 0.3 ? cashMethod?.id : vnpayMethod?.id;
        }

        if (chosenMethodId) {
            paymentDetailCreate = {
                create: {
                    amount: originalPrice,
                    status: 'completed',
                    payment_time: orderDate,
                    payment_method: { connect: { id: chosenMethodId } }
                }
            };
        }
    }

    // 5. Create
    await prisma.order.create({
        data: {
            created_at: orderDate,
            status: status,
            orderType: orderType,
            original_price: originalPrice,
            final_price: originalPrice,
            Customer: { connect: { id: customer.id } },
            Staff: (orderType === OrderType.POS && staff) ? { connect: { id: staff.id } } : undefined,
            shippingAddress: shippingAddressString,
            order_details: { create: orderDetailsData },
            PaymentDetail: paymentDetailCreate
        }
    });
}