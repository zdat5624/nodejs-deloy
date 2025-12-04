import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Put } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/order/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AuthGuard } from '@nestjs/passport';
import { GetAllOrderDto } from './dto/GetAllOrder.dto';
import { UpdateOrderStatusDTO } from './dto/UpdateOrderStatus.dto';
import { PaymentDTO } from './dto/payment.dto';
import { GetUser } from 'src/auth/decorator';
import * as client from '@prisma/client';
import { OrderStatus } from 'src/common/enums/orderStatus.enum';
@Controller('order')
// @UseGuards(AuthGuard('jwt'), RolesGuard)
// @Role('owner', 'manager','cashier')
export class OrderController {
  constructor(private readonly orderService: OrderService) { }

  @Get('process-count')
  getActiveOrderCount() {
    return this.orderService.getProcessOrderCount();
  }

  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.orderService.create(createOrderDto);
  }
  @Get('vnpay-ipn')
  vnpayIpn(@Query() query: any) {
    return this.orderService.vnpayIpn(query);
  }


  @Get('user')
  @UseGuards(AuthGuard('jwt'))
  findAllOfUser(@GetUser() user: client.User, @Query() dto: GetAllOrderDto,) {
    dto.searchCustomerPhone = user.phone_number;
    return this.orderService.findAllOfUser(dto);
  }

  @Get()
  findAll(@Query() dto: GetAllOrderDto) {
    return this.orderService.findAll(dto);
  }
  @Get('vnpay-return')
  vnpayResponse(@Query() query: any) {
    return this.orderService.vnpayResponse(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(Number(id));
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('status')
  updateStatus(@Body() dto: UpdateOrderStatusDTO, @GetUser() user: client.User) {
    return this.orderService.updateStatus(dto, undefined, user.id);
  }

  @Patch('user/cancel/:id')
  userCancelOrder(@Param('id') id: number, @GetUser() user: client.User) {
    const dto = new UpdateOrderStatusDTO();
    dto.orderId = id;
    dto.status = OrderStatus.CANCELED;

    return this.orderService.updateStatus(dto, undefined, undefined);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto, @GetUser() user: client.User) {
    return this.orderService.update(+id, updateOrderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.orderService.remove(+id);
  }
  @Patch('paid/cash')
  paid(@Body() paymentDTO: PaymentDTO) {
    return this.orderService.payByCash(paymentDTO);
  }
  @Post('paid/online')
  paidOnline(@Body() paymentDTO: PaymentDTO) {
    return this.orderService.payOnline(paymentDTO);
  }
  @Put(':id')
  updateOrderItems(@Param('id') id: string, @Body() updateItemsDto: UpdateOrderDto) {
    return this.orderService.updateItems(+id, updateItemsDto)
  }
  @Get('invoice/:orderId')
  getInvoice(@Param('orderId') orderId: string) {
    return this.orderService.getInvoice(+orderId);
  }






}
