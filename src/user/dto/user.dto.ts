import { File } from "buffer";
import { IsDate, IsEmail, IsEnum, IsOptional, IsPhoneNumber, IsString } from "class-validator";
import { Sex } from "src/common/enums/sex.enum";

export class UserUpdateDTO {
    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsOptional()
    // @IsDate() // Lưu ý: Nếu gửi từ FormData, ngày tháng sẽ là string, cần Transform
    // @Transform(({ value }) => new Date(value)) 
    birthday?: any; // Để any hoặc string để handle việc parse từ FormData an toàn hơn

    @IsOptional()
    @IsEnum(Sex)
    sex?: Sex;

    @IsOptional()
    @IsString()
    address?: string;

    avatar?: any;
}

export class ChangeSensitiveInfoDTO {
    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    @IsPhoneNumber("VN")
    phone?: string;
}
