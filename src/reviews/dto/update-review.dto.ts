import { PartialType } from '@nestjs/mapped-types'; // Hoặc @nestjs/swagger
import { CreateReviewDto } from './create-review.dto';
import { IsNumber, IsOptional } from 'class-validator';

// Chỉ cho phép sửa rating và comment, không cho sửa productId
export class UpdateReviewDto extends PartialType(CreateReviewDto) {
    // productId bị loại bỏ hoặc override để không validate, nhưng tốt nhất 
    // là trong service ta sẽ ignore field productId nếu user gửi lên.
}