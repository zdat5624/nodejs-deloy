import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    UseGuards,
    Request,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { GetUser } from 'src/auth/decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CheckoutCartDto } from './dto/checkout.dto';
// import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard'; // Uncomment khi dùng

@Controller('cart')
@UseGuards(JwtAuthGuard) // Bật Auth lên
export class CartController {
    constructor(private readonly cartService: CartService) { }

    @Post('checkout')
    async checkout(@GetUser('id') userId: number, @Body() dto: CheckoutCartDto) {
        return this.cartService.createOrderFromCart(userId, dto);
    }

    @Get()
    async getCart(@Request() req, @GetUser('id') userId: number) {
        return this.cartService.getCart(userId);
    }

    @Post('add')
    async addToCart(@Request() req, @Body() dto: AddToCartDto, @GetUser('id') userId: number) {
        return this.cartService.addToCart(userId, dto);
    }

    @Patch('item/:id')
    async updateCartItem(
        @Request() req,
        @Param('id', ParseIntPipe) itemId: number,
        @Body() dto: UpdateCartItemDto,
        @GetUser('id') userId: number
    ) {
        return this.cartService.updateItem(userId, itemId, dto);
    }

    @Delete('item/:id')
    async removeCartItem(
        @Request() req,
        @Param('id', ParseIntPipe) itemId: number, @GetUser('id') userId: number
    ) {
        return this.cartService.removeItem(userId, itemId);
    }

    @Delete()
    async clearCart(@Request() req, @GetUser('id') userId: number) {
        return this.cartService.clearCart(userId);
    }
}