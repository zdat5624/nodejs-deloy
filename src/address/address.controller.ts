import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    ParseIntPipe,
} from '@nestjs/common';
import { AddressService } from './address.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/auth/decorator/user.decorator'; // Sửa lại đường dẫn nếu cần

@Controller('address')
@UseGuards(JwtAuthGuard)
export class AddressController {
    constructor(private readonly addressService: AddressService) { }

    @Post()
    create(@GetUser('id') userId: number, @Body() createAddressDto: CreateAddressDto) {
        return this.addressService.create(userId, createAddressDto);
    }

    @Get()
    findAll(@GetUser('id') userId: number) {
        return this.addressService.findAll(userId);
    }

    @Get(':id')
    findOne(@GetUser('id') userId: number, @Param('id', ParseIntPipe) id: number) {
        return this.addressService.findOne(userId, id);
    }

    @Patch(':id')
    update(
        @GetUser('id') userId: number,
        @Param('id', ParseIntPipe) id: number,
        @Body() updateAddressDto: UpdateAddressDto,
    ) {
        return this.addressService.update(userId, id, updateAddressDto);
    }

    @Patch(':id/set-default')
    setDefault(
        @GetUser('id') userId: number,
        @Param('id', ParseIntPipe) id: number
    ) {
        return this.addressService.setDefault(userId, id);
    }

    @Delete(':id')
    remove(@GetUser('id') userId: number, @Param('id', ParseIntPipe) id: number) {
        return this.addressService.remove(userId, id);
    }
}