import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    // Bạn có thể override handleRequest ở đây nếu muốn tùy chỉnh lỗi
    // Nhưng mặc định class này đã đủ dùng
}