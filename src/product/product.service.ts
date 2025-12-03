import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

import { Prisma } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { GetAllProductsDto } from './dto/get-all-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ResponseGetAllDto } from 'src/common/dto/pagination.dto';
import { MenuProductDetailResponse, PosProductDetailResponse, ProductDetailResponse, SellProductSizeResponse } from './dto/response.dto';
import { GetAllMenuProductsDto } from './dto/get-all-menu-products.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) { }

  async toggleActiveStatus(id: number, isActive: boolean) {
    return await this.prisma.product.update({
      where: { id },
      data: { isActive },
    });
  }

  async create(dto: CreateProductDto) {
    const {
      name,
      is_multi_size,
      product_detail,
      price,
      sizeIds,
      optionValueIds,
      toppingIds,
      categoryId,
    } = dto;

    // Validate logic
    if (!is_multi_size && (price === undefined || price === null)) {
      throw new Error('Product must have a price when is_multi_size = false');
    }

    if (is_multi_size) {
      if (!sizeIds || sizeIds.length === 0) {
        throw new Error('Product must have sizes when is_multi_size = true');
      }
      if (price !== undefined && price !== null) {
        throw new Error('Product price must be null when using multi size');
      }
    }

    const product = await this.prisma.product.create({
      data: {
        name,
        is_multi_size,
        product_detail,
        price,
        isTopping: dto.isTopping,
        category: categoryId ? { connect: { id: categoryId } } : undefined,
        sizes: sizeIds
          ? {
            create: sizeIds.map((s) => ({
              size_id: s.id,
              price: s.price,
            })),
          }
          : undefined,
        optionValues: optionValueIds
          ? {
            create: optionValueIds.map((id) => ({ option_value_id: id })),
          }
          : undefined,
        toppings: toppingIds
          ? {
            create: toppingIds.map((id) => ({ topping_id: id })),
          }
          : undefined,
        images: dto.images
          ? {
            create: dto.images.map((img) => ({
              image_name: img.image_name,
              sort_index: img.sort_index,
            })),
          }
          : undefined,
      },
    });

    const new_product_detail = await this.findOne(product.id);
    return new_product_detail;
  }

  async findAll(
    query: GetAllProductsDto,
  ): Promise<ResponseGetAllDto<ProductDetailResponse>> {
    const {
      page,
      size,
      search,
      orderBy = 'id',
      orderDirection = 'asc',
      categoryId,
      isTopping,
    } = query;

    let categoryIds: number[] | undefined;

    //  Nếu có filter theo categoryId, lấy tất cả category con (nếu có)
    if (categoryId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: categoryId },
        include: { subcategories: true },
      });

      if (parent) {
        // Gộp category cha + con
        categoryIds = [parent.id, ...parent.subcategories.map((c) => c.id)];
      }
    }

    const where: Prisma.ProductWhereInput = {
      AND: [
        search
          ? { name: { contains: search, mode: Prisma.QueryMode.insensitive } }
          : {},
        categoryId === -1 // nếu chọn "Chưa phân loại"
          ? { category_id: null }
          : categoryIds
            ? { category_id: { in: categoryIds } }
            : {},
        isTopping !== undefined ? { isTopping } : {},
      ],
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          images: true,
          sizes: {
            include: { size: true },
            orderBy: {
              size: {
                sort_index: 'asc' // Sắp xếp theo 'sort_index' của 'size'
              }
            }
          },
          toppings: {
            select: {
              topping: {
                include: {
                  images: true,
                },
              },
            },
          },
          optionValues: {
            include: {
              option_value: {
                include: { option_group: true },
              },
            },
          },
        },
        orderBy: { [orderBy]: orderDirection },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.product.count({ where }),
    ]);

    // 🔹 Map dữ liệu sang ProductDetailResponse
    const data: ProductDetailResponse[] = products.map((product) => {
      const optionGroupsMap = new Map<number, any>();

      for (const pov of product.optionValues) {
        const group = pov.option_value.option_group;
        const value = pov.option_value;

        if (!optionGroupsMap.has(group.id)) {
          optionGroupsMap.set(group.id, {
            id: group.id,
            name: group.name,
            values: [],
          });
        }

        optionGroupsMap.get(group.id).values.push({
          id: value.id,
          name: value.name,
          sort_index: value.sort_index,
        });
      }

      return {
        id: product.id,
        name: product.name,
        is_multi_size: product.is_multi_size,
        product_detail: product.product_detail,
        isTopping: product.isTopping,
        price: product.price,
        category_id: product.category_id,
        category: product.category,
        images: product.images,
        sizes: product.sizes.map((s) => ({
          id: s.id,
          price: s.price,
          size: s.size,
        })),
        toppings: product.toppings.map((t) => {
          return {
            id: t.topping.id,
            name: t.topping.name,
            price: t.topping.price ?? 0,
            image_name: t.topping.images[0]?.image_name || null,
            sort_index: t.topping.images[0]?.sort_index || 0,
          };
        }),
        optionGroups: Array.from(optionGroupsMap.values()),
      };
    });

    // 🔹 Kết quả trả về

    return {
      data,
      meta: {
        total,
        page,
        size,
        totalPages: Math.ceil(total / size),
      },
    };
  }

  async findAllPos(
    query: GetAllProductsDto,
    // ✅ 1. Thay đổi kiểu trả về sang Response Type mới
  ): Promise<ResponseGetAllDto<PosProductDetailResponse>> {
    const {
      page,
      size,
      search,
      orderBy = 'id',
      orderDirection = 'asc',
      categoryId,
      isTopping,
    } = query;

    let categoryIds: number[] | undefined;

    //  Nếu có filter theo categoryId, lấy tất cả category con (nếu có)
    if (categoryId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: categoryId },
        include: { subcategories: true },
      });

      if (parent) {
        // Gộp category cha + con
        categoryIds = [parent.id, ...parent.subcategories.map((c) => c.id)];
      }
    }

    const where: Prisma.ProductWhereInput = {
      AND: [
        search
          ? { name: { contains: search, mode: Prisma.QueryMode.insensitive } }
          : {},
        categoryId === -1 // nếu chọn "Chưa phân loại"
          ? { category_id: null }
          : categoryIds
            ? { category_id: { in: categoryIds } }
            : {},
        isTopping !== undefined ? { isTopping } : {},
      ],
    };

    // ✅ 2. Lấy ngày giờ hiện tại để lọc các khuyến mãi hợp lệ
    const now = new Date();
    const promotionFilter = {
      Promotion: {
        is_active: true,
        start_date: { lte: now }, // Bắt đầu <= hiện tại
        end_date: { gte: now }, // Kết thúc >= hiện tại
      },
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          images: true,
          // ✅ 3. Include KM cho sản phẩm 1 size (hoặc base product)
          ProductPromotion: {
            where: {
              productSizeId: null, // Lọc KM cho base product (không phải size)
              ...promotionFilter,
            },
            select: { new_price: true },
          },
          sizes: {
            orderBy: { size: { sort_index: 'asc' } }, // Sắp xếp size
            include: {
              size: true,
              // ✅ 4. Include KM cho từng size (sản phẩm nhiều size)
              ProductPromotion: {
                where: promotionFilter, // Tự động lọc theo productSizeId
                select: { new_price: true },
              },
            },
          },
          // ✅ 5. Topping: Giữ nguyên, không lấy KM
          toppings: {
            select: {
              topping: {
                include: {
                  images: true,
                },
              },
            },
          },
          optionValues: {
            include: {
              option_value: {
                include: { option_group: true },
              },
            },
          },
        },
        orderBy: { [orderBy]: orderDirection },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.product.count({ where }),
    ]);

    // 🔹 Map dữ liệu sang PosProductDetailResponse
    // ✅ 6. Thay đổi kiểu của data sang Response Type mới
    const data: PosProductDetailResponse[] = products.map((product) => {
      const optionGroupsMap = new Map<number, any>();

      for (const pov of product.optionValues) {
        const group = pov.option_value.option_group;
        const value = pov.option_value;

        if (!optionGroupsMap.has(group.id)) {
          optionGroupsMap.set(group.id, {
            id: group.id,
            name: group.name,
            values: [],
          });
        }

        optionGroupsMap.get(group.id).values.push({
          id: value.id,
          name: value.name,
          sort_index: value.sort_index,
        });
      }

      // ✅ 7. Xử lý giá cho sản phẩm 1 size
      const mainOldPrice = product.price ?? null;
      const mainPromotion = product.ProductPromotion?.[0]; // Lấy KM đã lọc
      const mainPrice = mainPromotion?.new_price ?? mainOldPrice;

      // ✅ 8. Xử lý giá cho sản phẩm nhiều size
      const mappedSizes: SellProductSizeResponse[] = product.sizes.map((s) => {
        const sizeOldPrice = s.price;
        const sizePromotion = s.ProductPromotion?.[0]; // Lấy KM đã lọc cho size này
        const sizePrice = sizePromotion?.new_price ?? sizeOldPrice;

        return {
          id: s.id,
          price: sizePrice, // Giá mới (hoặc giá cũ)
          old_price: sizePrice !== sizeOldPrice ? sizeOldPrice : undefined, // Chỉ gán nếu có KM
          size: s.size,
        };
      });

      // ✅ 9. Xử lý toppings (trả về giá gốc)
      const mappedToppings = product.toppings.map((t) => {
        return {
          id: t.topping.id,
          name: t.topping.name,
          price: t.topping.price ?? 0, // Luôn là giá gốc
          image_name: t.topping.images[0]?.image_name || null,
          sort_index: t.topping.images[0]?.sort_index || 0,
        };
      });

      return {
        id: product.id,
        name: product.name,
        is_multi_size: product.is_multi_size,
        product_detail: product.product_detail,
        isTopping: product.isTopping,
        price: mainPrice, // Giá mới (hoặc giá cũ)
        old_price: mainPrice !== mainOldPrice ? mainOldPrice : undefined, // Chỉ gán nếu có KM
        category_id: product.category_id,
        category: product.category,
        images: product.images,
        sizes: mappedSizes,
        toppings: mappedToppings,
        optionGroups: Array.from(optionGroupsMap.values()),
      };
    });

    // 🔹 Kết quả trả về

    return {
      data,
      meta: {
        total,
        page,
        size,
        totalPages: Math.ceil(total / size),
      },
    };
  }

  async findOne(id: number): Promise<ProductDetailResponse> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: true,
        sizes: {
          include: { size: true },
          orderBy: {
            size: {
              sort_index: 'asc' // Sắp xếp theo 'sort_index' của 'size'
            }
          }
        },
        toppings: {
          select: {
            topping: {
              include: { images: true },
            },
          },
        },
        optionValues: {
          include: {
            option_value: {
              include: { option_group: true },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    const optionGroupsMap = new Map<number, any>();

    for (const pov of product.optionValues) {
      const group = pov.option_value.option_group;
      const value = pov.option_value;

      if (!optionGroupsMap.has(group.id)) {
        optionGroupsMap.set(group.id, {
          id: group.id,
          name: group.name,
          values: [],
        });
      }
      optionGroupsMap.get(group.id).values.push({
        id: value.id,
        name: value.name,
        sort_index: value.sort_index,
      });
    }

    return {
      id: product.id,
      name: product.name,
      is_multi_size: product.is_multi_size,
      isTopping: product.isTopping,
      product_detail: product.product_detail,
      price: product.price,
      category_id: product.category_id,
      category: product.category,
      images: product.images,
      sizes: product.sizes.map((s) => ({
        id: s.id,
        price: s.price,
        size: s.size,
      })),
      toppings: product.toppings.map((t) => {
        return {
          id: t.topping.id,
          name: t.topping.name,
          price: t.topping.price ?? 0,
          image_name: t.topping.images[0]?.image_name || null,
          sort_index: t.topping.images[0]?.sort_index || 0,
        };
      }),
      optionGroups: Array.from(optionGroupsMap.values()),
    };
  }

  async update(id: number, dto: UpdateProductDto) {
    const {
      name,
      is_multi_size,
      product_detail,
      price,
      sizeIds,
      optionValueIds,
      toppingIds,
      categoryId,
    } = dto;

    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { sizes: true, optionValues: true, toppings: true },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const finalIsMultiSize = is_multi_size ?? existing.is_multi_size;

    // Validate logic
    if (!finalIsMultiSize && (price === undefined || price === null)) {
      throw new Error('Product must have a price when is_multi_size = false');
    }

    if (finalIsMultiSize) {
      if (!sizeIds || sizeIds.length === 0) {
        throw new Error('Product must have sizes when is_multi_size = true');
      }
      if (price !== undefined && price !== null) {
        throw new Error('Product price must be null when using multi size');
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        name,
        is_multi_size,
        product_detail,
        price,
        isTopping: dto.isTopping,
        category: categoryId ? { connect: { id: categoryId } } : undefined,
        // Cập nhật quan hệ (topping, option, size)
        sizes: sizeIds
          ? {
            deleteMany: {}, // xoá toàn bộ cũ
            create: sizeIds.map((s) => ({
              size_id: s.id,
              price: s.price,
            })),
          }
          : undefined,
        optionValues: optionValueIds
          ? {
            deleteMany: {},
            create: optionValueIds.map((id) => ({ option_value_id: id })),
          }
          : undefined,
        toppings: toppingIds
          ? {
            deleteMany: {},
            create: toppingIds.map((id) => ({ topping_id: id })),
          }
          : undefined,
        images: dto.images
          ? {
            deleteMany: {},
            create: dto.images.map((img) => ({
              image_name: img.image_name,
              sort_index: img.sort_index,
            })),
          }
          : undefined,
      },
      include: { sizes: true, optionValues: true, toppings: true },
    });
  }

  async remove(id: number) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    // delete related records
    await this.prisma.productSize.deleteMany({ where: { product_id: id } });
    await this.prisma.productOptionValue.deleteMany({
      where: { product_id: id },
    });
    await this.prisma.productTopping.deleteMany({ where: { product_id: id } });
    await this.prisma.productImage.deleteMany({ where: { product_id: id } });

    return this.prisma.product.delete({ where: { id } });
  }

  async removeMany(ids: number[]) {
    if (!ids || ids.length === 0) {
      throw new Error('No product IDs provided for deletion');
    }

    // Kiểm tra sản phẩm tồn tại
    const existingProducts = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });

    if (existingProducts.length === 0) {
      throw new NotFoundException('No valid product IDs found');
    }

    const existingIds = existingProducts.map((p) => p.id);

    // Dùng transaction để đảm bảo tính toàn vẹn dữ liệu
    await this.prisma.$transaction(async (tx) => {
      await tx.productSize.deleteMany({
        where: { product_id: { in: existingIds } },
      });

      await tx.productOptionValue.deleteMany({
        where: { product_id: { in: existingIds } },
      });

      await tx.productTopping.deleteMany({
        where: { product_id: { in: existingIds } },
      });

      await tx.productImage.deleteMany({
        where: { product_id: { in: existingIds } },
      });

      await tx.product.deleteMany({
        where: { id: { in: existingIds } },
      });
    });

    return {
      message: `Deleted ${existingIds.length} product(s) successfully.`,
      deletedIds: existingIds,
    };
  }


  async findAllMenu(
    query: GetAllMenuProductsDto,
  ): Promise<ResponseGetAllDto<MenuProductDetailResponse>> {
    const {
      page,
      size,
      search,
      orderBy = 'id',
      orderDirection = 'asc',
      categoryId,
      isTopping,
      minPrice,
      maxPrice,
      isPromotion, // ✅
    } = query;

    // 1. Xử lý Category Filter (Giữ nguyên)
    let categoryIds: number[] | undefined;
    if (categoryId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: categoryId },
        include: { subcategories: true },
      });
      if (parent) {
        categoryIds = [parent.id, ...parent.subcategories.map((c) => c.id)];
      }
    }

    // 2. Tạo điều kiện Where cho Prisma (Giữ nguyên)
    const where: Prisma.ProductWhereInput = {
      AND: [
        search
          ? { name: { contains: search, mode: Prisma.QueryMode.insensitive } }
          : {},
        categoryId === -1
          ? { category_id: null }
          : categoryIds
            ? { category_id: { in: categoryIds } }
            : {},
        isTopping !== undefined ? { isTopping } : {},
      ],
    };

    // 3. Bộ lọc khuyến mãi (Giữ nguyên)
    const now = new Date();
    const promotionFilter = {
      Promotion: {
        is_active: true,
        start_date: { lte: now },
        end_date: { gte: now },
      },
    };

    // 4. Query DB: LẤY TẤT CẢ (Giữ nguyên)
    const productsRaw = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        images: true,
        ProductPromotion: {
          where: { productSizeId: null, ...promotionFilter },
          select: { new_price: true },
        },
        sizes: {
          orderBy: { size: { sort_index: 'asc' } },
          include: {
            size: true,
            ProductPromotion: {
              where: promotionFilter,
              select: { new_price: true },
            },
          },
        },
        toppings: {
          select: {
            topping: { include: { images: true } },
          },
        },
        optionValues: {
          include: {
            option_value: { include: { option_group: true } },
          },
        },
      },
      // Nếu sort là logic tính toán (price, discount) thì để Prisma sort mặc định
      orderBy:
        orderBy !== 'ui_price' && orderBy !== 'discount_percent'
          ? { [orderBy]: orderDirection }
          : undefined,
    });

    // ✅ 5. Mapping dữ liệu & Tính toán giá + Phần trăm giảm
    const fullData = productsRaw.map((product) => {
      // --- Logic Option Groups (Giữ nguyên) ---
      const optionGroupsMap = new Map<number, any>();
      for (const pov of product.optionValues) {
        const group = pov.option_value.option_group;
        const value = pov.option_value;
        if (!optionGroupsMap.has(group.id)) {
          optionGroupsMap.set(group.id, {
            id: group.id,
            name: group.name,
            values: [],
          });
        }
        optionGroupsMap
          .get(group.id)
          .values.push({
            id: value.id,
            name: value.name,
            sort_index: value.sort_index,
          });
      }

      // --- Logic Tính Giá ---
      let uiPrice = 0;
      let uiOldPrice: number | undefined = undefined;

      const mappedSizes = product.sizes.map((s) => {
        const sOld = s.price;
        const sNew = s.ProductPromotion?.[0]?.new_price ?? sOld;
        return {
          id: s.id,
          price: sNew,
          old_price: sNew < sOld ? sOld : undefined,
          size: s.size,
        };
      });

      if (product.is_multi_size) {
        if (mappedSizes.length > 0) {
          uiPrice = mappedSizes[0].price;
          uiOldPrice = mappedSizes[0].old_price;
        }
      } else {
        const pOld = product.price ?? 0;
        const pNew = product.ProductPromotion?.[0]?.new_price ?? pOld;
        uiPrice = pNew;
        uiOldPrice = pNew < pOld ? pOld : undefined;
      }

      // ✅ Tính phần trăm giảm giá (để sort)
      let discountPercent = 0;
      if (uiOldPrice && uiOldPrice > uiPrice) {
        // Công thức: (Giá cũ - Giá mới) / Giá cũ * 100
        discountPercent = Math.round(((uiOldPrice - uiPrice) / uiOldPrice) * 100);
      }

      // --- Logic Toppings (Giữ nguyên) ---
      const mappedToppings = product.toppings.map((t) => ({
        id: t.topping.id,
        name: t.topping.name,
        price: t.topping.price ?? 0,
        image_name: t.topping.images[0]?.image_name || null,
        sort_index: t.topping.images[0]?.sort_index || 0,
      }));

      return {
        id: product.id,
        name: product.name,
        is_multi_size: product.is_multi_size,
        product_detail: product.product_detail,
        isTopping: product.isTopping,

        ui_price: uiPrice,
        old_price: uiOldPrice,
        discount_percent: discountPercent, // ✅ Trường này dùng để sort nội bộ (hoặc trả về FE nếu cần)

        price: product.price,
        category_id: product.category_id,
        category: product.category,
        images: product.images,
        sizes: mappedSizes,
        toppings: mappedToppings,
        optionGroups: Array.from(optionGroupsMap.values()),
      };
    });

    // ✅ 6. Lọc dữ liệu (Filter In-Memory)
    let processedData = fullData;

    // 6.1 Lọc theo Range Giá
    if (minPrice !== undefined || maxPrice !== undefined) {
      processedData = processedData.filter((item) => {
        const checkMin = minPrice !== undefined ? item.ui_price >= minPrice : true;
        const checkMax = maxPrice !== undefined ? item.ui_price <= maxPrice : true;
        return checkMin && checkMax;
      });
    }

    // 6.2 Lọc chỉ lấy sản phẩm có giảm giá
    if (isPromotion) {
      processedData = processedData.filter((item) => item.discount_percent > 0);
    }

    // ✅ 7. Sắp xếp (In-Memory Sort)
    if (orderBy === 'ui_price') {
      processedData.sort((a, b) => {
        return orderDirection === 'asc'
          ? a.ui_price - b.ui_price
          : b.ui_price - a.ui_price;
      });
    } else if (orderBy === 'discount_percent') {
      // Sort theo phần trăm giảm
      processedData.sort((a, b) => {
        return orderDirection === 'asc'
          ? a.discount_percent - b.discount_percent // Thấp -> Cao
          : b.discount_percent - a.discount_percent; // Cao -> Thấp (Thường dùng cái này)
      });
    }

    // ✅ 8. Phân trang thủ công
    const total = processedData.length;
    const startIndex = (page - 1) * size;
    const endIndex = startIndex + size;
    const paginatedData = processedData.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      meta: {
        total,
        page,
        size,
        totalPages: Math.ceil(total / size) || 1,
      },
    };
  }



  async findRelated(productId: number, limit: number = 4) {
    // 1. Lấy thông tin sản phẩm (Kèm danh sách subcategories để dùng nếu nó là Cha)
    const currentProduct = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: {
          include: { subcategories: true }, // Lấy danh sách con
        },
      },
    });

    if (!currentProduct) {
      throw new NotFoundException('Product not found');
    }

    const relatedIds = new Set<number>();
    const excludeIds: number[] = [productId];

    // Helper fetch (giữ nguyên)
    const fetchAndAccumulate = async (whereCondition: Prisma.ProductWhereInput) => {
      if (relatedIds.size >= limit) return;
      const needed = limit - relatedIds.size;

      const items = await this.prisma.product.findMany({
        where: {
          ...whereCondition,
          isActive: true,
          id: { notIn: excludeIds },
        },
        select: { id: true },
        take: needed,
        orderBy: { id: 'desc' }, // Mới nhất trước
      });

      items.forEach((item) => {
        relatedIds.add(item.id);
        excludeIds.push(item.id);
      });
    };

    // --- BƯỚC 1: Cùng Category trực tiếp (Direct Siblings) ---
    // Tìm các sản phẩm nằm chung folder Category hiện tại
    if (currentProduct.category_id) {
      await fetchAndAccumulate({
        category_id: currentProduct.category_id,
      });
    }

    // --- BƯỚC 2: Mở rộng quan hệ Category (Cha <-> Con <-> Anh Em) ---
    if (relatedIds.size < limit && currentProduct.category) {

      // TRƯỜNG HỢP A: Sản phẩm hiện tại là CON (Có cha)
      // -> Tìm các sp thuộc Category CHA hoặc Category ANH EM (Cùng cha)
      if (currentProduct.category.parent_category_id) {
        await fetchAndAccumulate({
          category: {
            OR: [
              { id: currentProduct.category.parent_category_id }, // Sp nằm ở Cha
              { parent_category_id: currentProduct.category.parent_category_id } // Sp nằm ở Anh Em
            ]
          }
        });
      }

      // TRƯỜNG HỢP B: Sản phẩm hiện tại là CHA (Có con)
      // -> Tìm các sp nằm trong các Category CON của nó
      else if (currentProduct.category.is_parent_category && currentProduct.category.subcategories.length > 0) {
        const subCategoryIds = currentProduct.category.subcategories.map(c => c.id);
        await fetchAndAccumulate({
          category_id: { in: subCategoryIds }
        });
      }
    }

    // --- BƯỚC 3: Tìm theo thuộc tính (Fallback) ---
    if (relatedIds.size < limit) await fetchAndAccumulate({ is_multi_size: currentProduct.is_multi_size });
    if (relatedIds.size < limit) await fetchAndAccumulate({ isTopping: currentProduct.isTopping });

    // --- BƯỚC 4: Random lấp đầy (nếu vẫn thiếu) ---
    if (relatedIds.size < limit) await fetchAndAccumulate({});

    // --- BƯỚC CUỐI: Map dữ liệu chuẩn Menu ---
    const resultIds = Array.from(relatedIds);
    const detailedProducts = await Promise.all(
      resultIds.map((id) => this.findOneMenu(id)) // Dùng hàm findOneMenu đã tạo
    );

    return detailedProducts;
  }

  private mapToMenuProduct(product: any): MenuProductDetailResponse {
    // A. Logic Option Groups
    const optionGroupsMap = new Map<number, any>();
    for (const pov of product.optionValues) {
      const group = pov.option_value.option_group;
      const value = pov.option_value;
      if (!optionGroupsMap.has(group.id)) {
        optionGroupsMap.set(group.id, {
          id: group.id,
          name: group.name,
          values: [],
        });
      }
      optionGroupsMap.get(group.id).values.push({
        id: value.id,
        name: value.name,
        sort_index: value.sort_index,
      });
    }

    // B. Logic Tính Giá (Có áp dụng Khuyến mãi)
    let uiPrice = 0;
    let uiOldPrice: number | undefined = undefined;

    // Map size và tính giá cho từng size
    const mappedSizes: SellProductSizeResponse[] = product.sizes.map((s) => {
      const sOld = s.price;
      const sNew = s.ProductPromotion?.[0]?.new_price ?? sOld;
      return {
        id: s.id,
        price: sNew, // Giá thực tế (đã giảm hoặc giữ nguyên)
        old_price: sNew < sOld ? sOld : undefined, // Giá cũ (chỉ hiện nếu có giảm)
        size: s.size,
      };
    });

    if (product.is_multi_size) {
      // Nếu nhiều size, lấy giá của size đầu tiên (thường là size nhỏ nhất do đã sort) làm giá hiển thị
      if (mappedSizes.length > 0) {
        uiPrice = mappedSizes[0].price;
        uiOldPrice = mappedSizes[0].old_price;
      }
    } else {
      // Nếu 1 size, lấy giá base
      const pOld = product.price ?? 0;
      const pNew = product.ProductPromotion?.[0]?.new_price ?? pOld;
      uiPrice = pNew;
      uiOldPrice = pNew < pOld ? pOld : undefined;
    }

    // C. Logic Toppings
    const mappedToppings = product.toppings.map((t) => ({
      id: t.topping.id,
      name: t.topping.name,
      price: t.topping.price ?? 0,
      image_name: t.topping.images[0]?.image_name || null,
      sort_index: t.topping.images[0]?.sort_index || 0,
    }));

    // D. Trả về kết quả
    return {
      id: product.id,
      name: product.name,
      is_multi_size: product.is_multi_size,
      product_detail: product.product_detail,
      isTopping: product.isTopping,

      // Các trường giá hiển thị UI
      ui_price: uiPrice,
      old_price: uiOldPrice,

      price: product.price, // Giá gốc base
      category_id: product.category_id,
      category: product.category,
      images: product.images,
      sizes: mappedSizes,
      toppings: mappedToppings,
      optionGroups: Array.from(optionGroupsMap.values()),
    };
  }

  // =================================================================================================
  // 2. API: findOneMenu (Lấy chi tiết 1 sản phẩm chuẩn Menu)
  // =================================================================================================
  async findOneMenu(id: number): Promise<MenuProductDetailResponse> {
    const now = new Date();
    // Điều kiện lọc khuyến mãi hợp lệ
    const promotionFilter = {
      Promotion: {
        is_active: true,
        start_date: { lte: now },
        end_date: { gte: now },
      },
    };

    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: true,
        // Include KM cho Base Product
        ProductPromotion: {
          where: { productSizeId: null, ...promotionFilter },
          select: { new_price: true },
        },
        // Include Sizes và KM theo Size
        sizes: {
          orderBy: { size: { sort_index: 'asc' } },
          include: {
            size: true,
            ProductPromotion: {
              where: promotionFilter,
              select: { new_price: true },
            },
          },
        },
        // Include Toppings
        toppings: {
          select: {
            topping: { include: { images: true } },
          },
        },
        // Include Options
        optionValues: {
          include: {
            option_value: { include: { option_group: true } },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    // Sử dụng hàm helper để map dữ liệu
    return this.mapToMenuProduct(product);
  }


  /**
   * Lấy danh sách MenuProduct bán chạy nhất
   * @param limit Số lượng sản phẩm muốn lấy
   * @param startDate Ngày bắt đầu
   * @param endDate Ngày kết thúc
   */
  async getBestSellingMenuProducts(
    limit: number,
    startDate: Date,
    endDate: Date
  ): Promise<MenuProductDetailResponse[]> {

    // BƯỚC 1: Query GroupBy để lấy ra các product_id bán chạy nhất
    const topSellingItems = await this.prisma.orderDetail.groupBy({
      by: ['product_id'],
      _sum: {
        quantity: true,
      },
      where: {
        order: {
          created_at: {
            gte: startDate,
            lte: endDate,
          },
          status: {
            not: 'cancelled', // Loại bỏ đơn đã huỷ
          },
        },
      },
      orderBy: {
        _sum: {
          quantity: 'desc', // Sắp xếp giảm dần theo số lượng bán
        },
      },
      take: limit, // Giới hạn số lượng lấy ra
    });

    // BƯỚC 2: Map danh sách ID sang cấu trúc MenuProductDetailResponse
    // Dùng Promise.all để gọi song song hàm findOneMenu cho nhanh
    const productPromises = topSellingItems.map(async (item) => {
      try {
        // Tái sử dụng hàm findOneMenu logic phức tạp bạn đã có
        return await this.findOneMenu(item.product_id);
      } catch (error) {
        // Nếu sản phẩm đã bị xóa hoặc lỗi, trả về null để lọc sau
        return null;
      }
    });

    const results = await Promise.all(productPromises);

    // BƯỚC 3: Lọc bỏ null và trả về kết quả
    return results.filter((item) => item !== null) as MenuProductDetailResponse[];
  }
}
