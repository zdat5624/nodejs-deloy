import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { OrderType, Prisma } from '@prisma/client';
import { CreateOrderDto } from 'src/order/dto/order/create-order.dto';
import { CheckoutCartDto } from './dto/checkout.dto';
import { OrderService } from 'src/order/order.service';
import { orderItemDTO } from 'src/order/dto/order/item-order.dto';

@Injectable()
export class CartService {
    constructor(private prisma: PrismaService,
        private orderService: OrderService) { }

    // =================================================================
    // 1. GET CART (WITH REALTIME PRICING)
    // =================================================================
    async getCart(userId: number) {
        const cart = await this.prisma.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    orderBy: { id: 'desc' }, // Mới thêm lên đầu (schema bạn ko có createdAt nên dùng id)
                    include: {
                        product: {
                            include: {
                                images: true,
                                sizes: { include: { size: true } }, // Để lấy tên size
                            },
                        },
                        size: true,
                        cartItemToppings: {
                            include: { topping: true },
                        },
                        optionSelections: {
                            include: { option_group: true },
                        },
                    },
                },
            },
        });
        // console.log(cart);
        if (!cart) return null;

        // Tính toán giá Realtime cho từng item
        const now = new Date();
        const processedItems = await Promise.all(
            cart.items.map(async (item) => {
                // Lấy thông tin giá mới nhất từ DB (Product & Promotion)
                const { unitPrice, originalPrice, toppingTotal } =
                    await this.calculateRealtimePrice(
                        item.productId,
                        item.sizeId,
                        item.cartItemToppings.map((t) => t.toppingId),
                        now,
                    );

                return {
                    id: item.id,
                    productId: item.productId,
                    productName: item.product.name,
                    productImage: item.product.images[0]?.image_name || null,
                    sizeName: item.size?.name || null,
                    quantity: item.quantity,

                    unitPrice: unitPrice, // Giá thực tế (đã giảm)
                    originalPrice: originalPrice !== unitPrice ? originalPrice : null, // Giá gốc (để hiển thị gạch ngang)

                    // Tổng tiền dòng này = (Giá món + Giá Toppings) * Số lượng
                    totalPrice: (unitPrice + toppingTotal) * item.quantity,

                    toppings: item.cartItemToppings.map((t) => ({
                        name: t.topping.name,
                        price: t.topping.price || 0,
                    })),
                    options: item.optionSelections.map((o) => ({
                        groupName: o.option_group.name,
                        valueName: o.name,
                    })),
                };
            }),
        );

        const totalTemporaryPrice = processedItems.reduce(
            (sum, item) => sum + item.totalPrice,
            0,
        );

        return {
            id: cart.id,
            totalQuantity: processedItems.reduce((sum, item) => sum + item.quantity, 0),
            totalTemporaryPrice,
            items: processedItems,
        };
    }

    // =================================================================
    // 2. ADD TO CART (WITH MERGE LOGIC)
    // =================================================================
    async addToCart(userId: number, dto: AddToCartDto) {
        const { productId, quantity, sizeId, toppingIds = [], optionIds = [] } = dto;

        // A. Validate Input
        const product = await this.prisma.product.findUnique({
            where: { id: productId, isActive: true },
            include: { sizes: true }, // Check size hợp lệ
        });
        if (!product) throw new NotFoundException('Product not found or inactive');

        if (product.is_multi_size) {
            if (!sizeId) throw new BadRequestException('Size is required for this product');
            const isValidSize = product.sizes.some((s) => s.size_id === sizeId);
            if (!isValidSize) throw new BadRequestException('Invalid size for this product');
        }

        // B. Get or Create Cart
        let cart = await this.prisma.cart.findUnique({ where: { userId } });
        if (!cart) {
            cart = await this.prisma.cart.create({ data: { userId } });
        }

        // C. MERGE LOGIC: Tìm xem có item nào giống hệt không
        // Phải so sánh: ProductID, SizeID, Toppings (Set), Options (Set)

        // Lấy tất cả items của sản phẩm này trong giỏ
        const existingItems = await this.prisma.cartItem.findMany({
            where: {
                cartId: cart.id,
                productId: productId,
                sizeId: sizeId || null,
            },
            include: {
                cartItemToppings: true,
                optionSelections: true,
            },
        });

        let matchedItem: (typeof existingItems)[0] | undefined = undefined;

        for (const item of existingItems) {
            // 1. So sánh Toppings
            const currentToppingIds = item.cartItemToppings.map((t) => t.toppingId);
            if (!this.areArraysEqual(currentToppingIds, toppingIds)) continue;

            // 2. So sánh Options
            const currentOptionIds = item.optionSelections.map((o) => o.id);
            if (!this.areArraysEqual(currentOptionIds, optionIds)) continue;

            // Nếu chạy đến đây nghĩa là trùng khớp hoàn toàn
            matchedItem = item;
            break;
        }

        // D. Xử lý DB
        if (matchedItem) {
            // Case 1: Đã tồn tại -> Cộng dồn số lượng
            return this.prisma.cartItem.update({
                where: { id: matchedItem.id },
                data: { quantity: { increment: quantity } },
            });
        } else {
            // Case 2: Chưa tồn tại -> Tạo mới
            return this.prisma.cartItem.create({
                data: {
                    cartId: cart.id,
                    productId,
                    quantity,
                    sizeId: sizeId || null,
                    // Tạo quan hệ Toppings
                    cartItemToppings: {
                        create: toppingIds.map((tid) => ({
                            toppingId: tid,
                            quantity: 1, // Mặc định 1 phần topping
                        })),
                    },
                    // Tạo quan hệ Options (Implicit M-N)
                    optionSelections: {
                        connect: optionIds.map((oid) => ({ id: oid })),
                    },
                },
            });
        }
    }

    // =================================================================
    // 3. UPDATE ITEM QUANTITY
    // =================================================================
    async updateItem(userId: number, itemId: number, dto: UpdateCartItemDto) {
        const { quantity } = dto;

        // Check ownership
        const item = await this.prisma.cartItem.findFirst({
            where: { id: itemId, cart: { userId } },
        });
        if (!item) throw new NotFoundException('Cart item not found');

        if (quantity <= 0) {
            return this.removeItem(userId, itemId);
        }

        return this.prisma.cartItem.update({
            where: { id: itemId },
            data: { quantity },
        });
    }

    // =================================================================
    // 4. REMOVE ITEM
    // =================================================================
    async removeItem(userId: number, itemId: number) {
        // Check ownership before delete to prevent deleting other user's item
        const item = await this.prisma.cartItem.findFirst({
            where: { id: itemId, cart: { userId } },
        });
        if (!item) throw new NotFoundException('Cart item not found');

        return this.prisma.cartItem.delete({
            where: { id: itemId },
        });
    }

    // =================================================================
    // 5. CLEAR CART
    // =================================================================
    async clearCart(userId: number) {
        const cart = await this.prisma.cart.findUnique({ where: { userId } });
        if (!cart) return;

        // Xóa tất cả items trong cart
        // Nhờ onDelete: Cascade trong schema, cartItemToppings sẽ tự bay màu
        return this.prisma.cartItem.deleteMany({
            where: { cartId: cart.id },
        });
    }

    // =================================================================
    // 6. CHECKOUT (CREATE ORDER FROM CART)
    // =================================================================
    async createOrderFromCart(userId: number, dto: CheckoutCartDto) {
        // 1. Lấy giỏ hàng đầy đủ thông tin
        const cart = await this.prisma.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    include: {
                        cartItemToppings: true,
                        optionSelections: true,
                    }
                }
            }
        });

        if (!cart || cart.items.length === 0) {
            throw new BadRequestException('Cart is empty');
        }

        // 2. Map Cart Items sang CreateOrderDto (theo cấu trúc OrderService yêu cầu)
        // Lưu ý: OrderService.create nhận vào string cho các ID (theo dto bạn gửi)
        const orderDetails = cart.items.map(item => {
            // Chuẩn bị toppingItems theo createToppingItemDTO
            const toppingItems = item.cartItemToppings.map(t => ({
                toppingId: t.toppingId.toString(),
                quantity: t.quantity.toString()
            }));

            // Chuẩn bị optionId string[]
            const optionId = item.optionSelections.map(o => o.id.toString());

            return {
                productId: item.productId.toString(),
                quantity: item.quantity.toString(),
                sizeId: item.sizeId ? item.sizeId.toString() : undefined, // Dùng undefined để khớp với optional
                toppingItems: toppingItems.length > 0 ? toppingItems : undefined,
                // ✅ FIX: Luôn truyền mảng optionId (string[]), không được trả về undefined vì DTO yêu cầu string[]
                optionId: optionId
            };
        });

        const createOrderDto: CreateOrderDto = {
            order_details: orderDetails,
            customerPhone: dto.customerPhone || undefined,
            note: dto.note,
            shippingAddress: dto.shippingAddress,
            orderType: OrderType.ONLINE,
        };

        // 3. Gọi Order Service để tạo đơn (Tái sử dụng logic tính giá, check kho,...)
        const newOrder = await this.orderService.create(createOrderDto);

        // 4. Nếu tạo đơn thành công -> Xóa giỏ hàng
        if (newOrder) {
            await this.clearCart(userId);
        }

        return newOrder;
    }
    // =================================================================
    // 🛡️ HELPER: CALCULATE PRICE (LOGIC ORDER SERVICE REPLICA)
    // =================================================================
    private async calculateRealtimePrice(
        productId: number,
        sizeId: number | null,
        toppingIds: number[],
        now: Date,
    ) {
        const promotionFilter = {
            is_active: true,
            start_date: { lte: now },
            end_date: { gte: now },
        };

        // 1. Fetch Product with deep nested promotions (Giống OrderService)
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            include: {
                // A. KM cho sản phẩm gốc
                ProductPromotion: {
                    where: { productSizeId: null, Promotion: promotionFilter },
                    orderBy: { new_price: 'asc' },
                },
                // B. Size và KM của Size
                sizes: {
                    include: {
                        ProductPromotion: {
                            where: { Promotion: promotionFilter },
                            orderBy: { new_price: 'asc' },
                        },
                    },
                },
            },
        });

        // 2. Fetch Toppings
        const toppings = await this.prisma.product.findMany({
            where: { id: { in: toppingIds } }
        });

        if (!product) return { unitPrice: 0, originalPrice: 0, toppingTotal: 0 };

        // --- LOGIC GIÁ ---
        let unitPrice = 0;
        let originalPrice = 0; // Giá chưa giảm

        if (sizeId) {
            // Có Size: Tìm record ProductSize tương ứng
            const productSizeRecord = product.sizes.find((ps) => ps.size_id === sizeId);
            if (productSizeRecord) {
                // Lấy KM nằm trong record size này
                const sizePromoPrice = productSizeRecord.ProductPromotion?.[0]?.new_price;
                originalPrice = productSizeRecord.price; // Giá gốc của size
                unitPrice = sizePromoPrice ?? originalPrice; // Nếu có KM lấy KM
            } else {
                // Fallback (ko tìm thấy size)
                unitPrice = product.price || 0;
                originalPrice = unitPrice;
            }
        } else {
            // Không Size: Lấy KM của Product
            const basePromoPrice = product.ProductPromotion?.[0]?.new_price;
            originalPrice = product.price || 0; // Giá gốc product
            unitPrice = basePromoPrice ?? originalPrice;
        }

        // --- LOGIC TOPPING ---
        const toppingTotal = toppings.reduce((sum, t) => sum + (t.price || 0), 0);

        return { unitPrice, originalPrice, toppingTotal };
    }

    // Helper so sánh 2 mảng số nguyên (không quan tâm thứ tự)
    private areArraysEqual(arr1: number[], arr2: number[]): boolean {
        if (arr1.length !== arr2.length) return false;
        const sorted1 = [...arr1].sort((a, b) => a - b);
        const sorted2 = [...arr2].sort((a, b) => a - b);
        return sorted1.every((val, index) => val === sorted2[index]);
    }
}