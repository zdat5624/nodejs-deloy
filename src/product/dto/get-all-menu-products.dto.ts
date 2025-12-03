import { Transform, Type } from 'class-transformer';
import { IsEnum, IsOptional, Min } from 'class-validator';
import { OrderDirection } from 'src/common/enums/order.enum';

export class GetAllMenuProductsDto {
  @Type(() => Number)
  @Min(1)
  page = 1;

  @Min(1)
  @Type(() => Number)
  size = 10;

  @IsOptional()
  search?: string;

  @Type(() => Number)
  @IsOptional()
  categoryId?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isTopping?: boolean;

  // ✅ Mới: Lọc chỉ lấy sản phẩm có khuyến mãi
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isPromotion?: boolean;

  @IsOptional()
  orderBy?: string = 'name'; // Có thể là 'ui_price' hoặc 'discount_percent'

  @IsEnum(OrderDirection)
  @IsOptional()
  orderDirection?: OrderDirection = OrderDirection.ASC;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maxPrice?: number;
}