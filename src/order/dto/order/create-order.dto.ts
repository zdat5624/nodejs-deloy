import { IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber } from "class-validator";
import { orderItemDTO } from "./item-order.dto";
import { Type } from "class-transformer";
import { OrderType } from "@prisma/client";

export class CreateOrderDto {
    // list produtc & quantity
    @IsNotEmpty()
    order_details: orderItemDTO[];

    @IsOptional()
    @IsPhoneNumber('VN')
    customerPhone?: string

    @IsOptional()
    @IsEnum(OrderType)
    orderType?: OrderType; // Để optional, backend sẽ tự gán

    @IsOptional() // StaffId bây giờ có thể không có
    staffId?: string;

    @IsOptional()
    note?: string;

    @IsOptional()
    shippingAddress?: string;
}