import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  Patch,
  ParseBoolPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ProductsService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { GetAllProductsDto } from './dto/get-all-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { GetAllMenuProductsDto } from './dto/get-all-menu-products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @Get('best-selling-menu')
  async getBestSellingMenu(
    // Nhận vào limit, mặc định là 10 nếu không truyền
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
  ) {
    // 1. Tự động tính toán khung thời gian 1 tháng gần nhất
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1); // Lùi về 1 tháng trước

    // 2. Gọi Service
    return this.productsService.getBestSellingMenuProducts(limit, startDate, endDate);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get("pos")
  findAllPos(@Query() query: GetAllProductsDto) {
    return this.productsService.findAllPos(query);
  }

  @Get("menu")
  findAllMenu(@Query() query: GetAllMenuProductsDto) {
    return this.productsService.findAllMenu(query);
  }
  @Get()
  findAll(@Query() query: GetAllProductsDto) {
    return this.productsService.findAll(query);
  }



  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(+id);
  }

  @Delete()
  removeMany(@Body() body: { ids: number[] }) {
    return this.productsService.removeMany(body.ids);
  }
  @Patch()
  toggleActiveStatus(
    @Query('id', ParseIntPipe) id: number,
    @Query('isActive', ParseBoolPipe) isActive: boolean,
  ) {
    return this.productsService.toggleActiveStatus(id, isActive);
  }


  @Get(':id/related')
  findRelated(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.productsService.findRelated(id, limit || 4);
  }


}
