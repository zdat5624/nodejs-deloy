import { IsArray, IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddToCartDto {
    @IsNotEmpty()
    @IsInt()
    productId: number;

    @IsNotEmpty()
    @IsInt()
    @Min(1)
    quantity: number;

    @IsOptional()
    @IsInt()
    sizeId?: number;

    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    toppingIds?: number[];

    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    optionIds?: number[]; // ID của OptionValue (Ví dụ: 50% đường)
}

export class UpdateCartItemDto {
    @IsNotEmpty()
    @IsInt()
    quantity: number; // Nếu <= 0 sẽ xóa item ở Service
}

// Response DTO để format dữ liệu trả về client đẹp hơn
export class CartResponseDto {
    id: number;
    totalQuantity: number;
    totalTemporaryPrice: number; // Tổng tiền tạm tính
    items: CartItemResponseDto[];
}

export class CartItemResponseDto {
    id: number;
    productId: number;
    productName: string;
    productImage: string | null;
    sizeName: string | null;

    quantity: number;
    unitPrice: number; // Giá đơn vị (đã tính KM) tại thời điểm gọi API
    originalPrice: number; // Giá gốc để gạch đi (nếu có KM)
    totalPrice: number; // unitPrice * quantity + toppingPrice

    toppings: { name: string; price: number }[];
    options: { groupName: string; valueName: string }[];
}