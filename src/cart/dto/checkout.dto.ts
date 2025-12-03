import { IsNotEmpty, IsOptional, IsPhoneNumber, IsString } from 'class-validator';

export class CheckoutCartDto {
    @IsOptional()
    @IsString()
    note?: string;

    @IsNotEmpty()
    @IsString()
    shippingAddress: string;

    @IsOptional()
    @IsPhoneNumber('VN')
    customerPhone?: string | null;


}