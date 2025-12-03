import { Logger } from '@nestjs/common';
import { PrismaClient, Unit } from '@prisma/client'; // <--- 1. Thêm Unit vào đây

const prisma = new PrismaClient();

export async function seedInventory() {
  Logger.log('🪄 Seeding Inventory (Units, Conversions, Materials)...');

  // ==========================================================
  // 1. SEED UNITS
  // ==========================================================

  let units: Unit[] = [];

  const unitCount = await prisma.unit.count();

  if (unitCount > 0) {
    Logger.log('⚠️ Units already exist → Skip creation, fetching existing...');
    units = await prisma.unit.findMany();
  } else {
    // 1.2 DATA
    const unitsData = [
      // Weight
      { name: 'Gram', symbol: 'g', class: 'weight' },
      { name: 'Kilogram', symbol: 'kg', class: 'weight' },

      // Volume
      { name: 'Milliliter', symbol: 'ml', class: 'volume' },
      { name: 'Liter', symbol: 'l', class: 'volume' },

      // Count (Đếm)
      { name: 'Piece', symbol: 'pcs', class: 'count' }, // Cái, ly, ống hút
      { name: 'Box', symbol: 'box', class: 'count' },   // Hộp (bánh, carton)
      { name: 'Bag', symbol: 'bag', class: 'count' },   // Túi (hạt cafe 5kg)

      // --- BỔ SUNG THÊM ---
      { name: 'Can', symbol: 'can', class: 'count' },   // Lon (sữa đặc)
      { name: 'Bottle', symbol: 'btl', class: 'count' },// Chai (syrup)
      { name: 'Pack', symbol: 'pack', class: 'count' }, // Gói (trà túi lọc)
    ];

    // 1.3 CREATE
    await prisma.unit.createMany({ data: unitsData });
    Logger.log('✅ Seeded Units');

    // Lấy lại data sau khi tạo để có ID
    units = await prisma.unit.findMany();
  }

  // Helper function để lấy ID từ Symbol
  const unitMap = new Map(units.map((u) => [u.symbol, u.id]));
  const getUnitId = (symbol: string) => {
    const id = unitMap.get(symbol);
    if (!id) throw new Error(`❌ Unit with symbol '${symbol}' not found!`);
    return id;
  };

  // ==========================================================
  // 2. SEED UNIT CONVERSIONS
  // ==========================================================
  const conversionCount = await prisma.unitConversion.count();
  if (conversionCount > 0) {
    Logger.log('⚠️ Unit Conversions already exist → Skip');
  } else {
    // 2.2 DATA
    const conversionsData = [
      { from: 'kg', to: 'g', factor: 1000 },
      { from: 'g', to: 'kg', factor: 0.001 },
      { from: 'l', to: 'ml', factor: 1000 },
      { from: 'ml', to: 'l', factor: 0.001 },
    ];

    // 2.3 CREATE
    for (const c of conversionsData) {
      await prisma.unitConversion.create({
        data: {
          from_unit: getUnitId(c.from),
          to_unit: getUnitId(c.to),
          factor: c.factor,
        },
      });
    }
    Logger.log('✅ Seeded Unit Conversions');
  }

  // ==========================================================
  // 3. SEED MATERIALS
  // ==========================================================
  const materialCount = await prisma.material.count();
  if (materialCount > 0) {
    Logger.log('⚠️ Materials already exist → Skip');
    return prisma.material.findMany();
  }

  // 3.2 DATA
  const materialsData = [
    // --- 1. COFFEE BEANS (Cốt lõi cho Cà phê) ---
    // Dùng cho Espresso, Americano, Latte (Pha máy)
    { name: 'Arabica Coffee Beans', unitId: getUnitId('kg'), code: 'mat_bean_arabica' },
    // Dùng cho Cà phê Phin Việt Nam (Đậm đà)
    { name: 'Robusta Coffee Beans', unitId: getUnitId('kg'), code: 'mat_bean_robusta' },
    // Dùng riêng cho Cold Brew (Thường là hạt Specialty rang light/medium)
    { name: 'Cold Brew Coffee Beans', unitId: getUnitId('kg'), code: 'mat_bean_coldbrew' },

    // --- 2. TEA & MATCHA (Cốt lõi cho Trà) ---
    // Dùng cho Matcha Tây Bắc
    { name: 'Matcha Powder (Vietnam)', unitId: getUnitId('kg'), code: 'mat_matcha_vn' },
    // Dùng cho Matcha Kyoto (Cao cấp hơn)
    { name: 'Matcha Powder (Premium Kyoto)', unitId: getUnitId('kg'), code: 'mat_matcha_jp' },
    // Dùng cho Trà trái cây (Lục trà/Trà lài)
    { name: 'Jasmine Green Tea Leaves', unitId: getUnitId('kg'), code: 'mat_tea_jasmine' },
    // Dùng cho Trà sữa truyền thống (Hồng trà)
    { name: 'Black Tea Leaves', unitId: getUnitId('kg'), code: 'mat_tea_black' },
    // Dùng cho các món trà sữa đặc biệt (Ô long)
    { name: 'Oolong Tea Leaves', unitId: getUnitId('kg'), code: 'mat_tea_oolong' },

    // --- 3. DAIRY & CREAMER (Sữa & Béo) ---
    // Dùng cho Latte, Cappuccino, Matcha Latte
    { name: 'Fresh Milk', unitId: getUnitId('l'), code: 'mat_milk_fresh' },
    // Dùng cho Cà phê Phin sữa đá, Bạc xỉu (Quan trọng)
    { name: 'Condensed Milk', unitId: getUnitId('can'), code: 'mat_milk_condensed' }, // Lon
    // Dùng cho Frappe (Đá xay) để tạo độ ngậy
    { name: 'Whipping Cream', unitId: getUnitId('l'), code: 'mat_cream_whipping' },
    // Dùng pha Trà sữa (Bột kem béo)
    { name: 'Non-dairy Creamer', unitId: getUnitId('kg'), code: 'mat_powder_creamer' },

    // --- 4. FLAVORINGS & SYRUPS (Hương liệu) ---
    // Dùng cho món Chocolate
    { name: 'Cocoa Powder', unitId: getUnitId('kg'), code: 'mat_powder_cocoa' },
    // Dùng cho món Chocolate (Sốt trang trí hoặc pha)
    { name: 'Chocolate Sauce', unitId: getUnitId('btl'), code: 'mat_sauce_choc' },
    // Dùng cho Frappe (Bột mix để chống tách nước)
    { name: 'Frappe Base Powder', unitId: getUnitId('kg'), code: 'mat_powder_frappe' },

    // Syrup Trà trái cây (Ví dụ đại diện)
    { name: 'Peach Syrup', unitId: getUnitId('btl'), code: 'mat_syrup_peach' },
    { name: 'Lychee Syrup', unitId: getUnitId('btl'), code: 'mat_syrup_lychee' },
    { name: 'Strawberry Syrup', unitId: getUnitId('btl'), code: 'mat_syrup_strawberry' },

    // Chất tạo ngọt cơ bản
    { name: 'White Sugar', unitId: getUnitId('kg'), code: 'mat_sugar_white' }, // <--- Đường thường
    { name: 'Sugar Syrup', unitId: getUnitId('l'), code: 'mat_syrup_sugar' }, // Nước đường
    { name: 'Honey', unitId: getUnitId('l'), code: 'mat_honey' }, // Dùng cho trà chanh/cam sả

    // --- 5. TOPPINGS ---
    { name: 'Tapioca Pearls (Raw)', unitId: getUnitId('kg'), code: 'mat_top_pearl' }, // Trân châu

    // --- 6. CONSUMABLES (Vật dụng) ---
    { name: 'Plastic Cup (M)', unitId: getUnitId('pcs'), code: 'item_cup_m' },
    { name: 'Plastic Cup (L)', unitId: getUnitId('pcs'), code: 'item_cup_l' },
    { name: 'Straw', unitId: getUnitId('pcs'), code: 'item_straw' },
    { name: 'Lid', unitId: getUnitId('pcs'), code: 'item_lid' }, // Nắp ly
  ];

  // 3.3 CREATE
  await prisma.material.createMany({
    data: materialsData,
  });

  Logger.log('✅ Seeded Materials');
  return prisma.material.findMany();
}