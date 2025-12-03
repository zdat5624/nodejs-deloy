import { IsBoolean, IsNotEmpty, IsOptional, IsPhoneNumber, IsString } from 'class-validator';

export class CreateAddressDto {
    @IsNotEmpty()
    @IsString()
    recipientName: string;

    @IsNotEmpty()
    @IsPhoneNumber('VN') // Validate số điện thoại VN
    phoneNumber: string;

    @IsNotEmpty()
    @IsString()
    fullAddress: string;

    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;
}

export class UpdateAddressDto {
    @IsOptional()
    @IsString()
    recipientName?: string;

    @IsOptional()
    @IsPhoneNumber('VN')
    phoneNumber?: string;

    @IsOptional()
    @IsString()
    fullAddress?: string;

    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;
}