import { Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { AddressController } from './address.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [AddressController],
    providers: [AddressService],
    exports: [AddressService], // Export service để OrderModule có thể dùng (ví dụ: lấy địa chỉ mặc định khi tạo đơn)
})
export class AddressModule { }