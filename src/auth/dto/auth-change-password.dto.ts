import { IsNotEmpty, MinLength } from 'class-validator';

export class AuthChangePasswordDto {
    @IsNotEmpty()
    oldPassword: string;

    @IsNotEmpty()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    newPassword: string;
}