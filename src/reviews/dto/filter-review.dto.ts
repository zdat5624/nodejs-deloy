import { IsInt, IsOptional, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class FilterReviewDto {
    @Type(() => Number)
    @IsInt()
    page: number = 1;

    @Type(() => Number)
    @IsInt()
    items_per_page: number = 10;

    @Type(() => Number)
    @IsInt()
    productId: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    rating?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    excludeUserId?: number;

    // --- THÊM PHẦN NÀY ---
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    isHidden?: boolean;
}