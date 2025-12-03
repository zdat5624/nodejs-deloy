import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedRecipes() {
    Logger.log('🪄 Seeding Recipes with Unit Conversion (g/ml -> kg/l)...');

    // 1. GET MASTER DATA (Kèm Unit để check)
    const products = await prisma.product.findMany({
        include: { category: true },
    });

    // Lấy Material kèm Unit để biết nó đang tính bằng kg hay g
    const materials = await prisma.material.findMany({
        include: { Unit: true },
    });

    const sizes = await prisma.size.findMany();

    // Helper: Tìm Material theo Code
    const getMaterial = (code: string) => {
        return materials.find((m) => m.code === code);
    };

    // Helper: Lấy Size ID
    const sizeS = sizes.find((s) => s.name === 'S')?.id;
    const sizeM = sizes.find((s) => s.name === 'M')?.id;
    const sizeL = sizes.find((s) => s.name === 'L')?.id;

    if (!sizeS || !sizeM || !sizeL) {
        Logger.error('❌ Missing sizes S, M, L.');
        return;
    }

    // -------------------------------------------------------
    // HÀM CHUYỂN ĐỔI QUAN TRỌNG
    // Input: Số lượng theo đơn vị nhỏ (g, ml)
    // Output: Số lượng theo đơn vị lưu kho (kg, l)
    // -------------------------------------------------------
    const convertToStorageUnit = (amountSmallUnit: number, materialUnitSymbol: string): number => {
        // Nếu kho lưu là kg hoặc lít -> Chia 1000
        if (['kg', 'l'].includes(materialUnitSymbol)) {
            return parseFloat((amountSmallUnit / 1000).toFixed(5)); // 20g -> 0.02kg
        }
        // Nếu kho lưu là g, ml, cái, hộp -> Giữ nguyên
        return amountSmallUnit;
    };

    // =====================================================================
    // 2. DEFINE FORMULA LOGIC (Dùng đơn vị g và ml)
    // =====================================================================

    // =====================================================================
    // 2. DEFINE FORMULA LOGIC (WITH RANDOM FALLBACK)
    // =====================================================================

    const generateIngredients = (productName: string, categoryName: string) => {
        const name = productName.toLowerCase();
        const cat = categoryName.toLowerCase();

        // Khai báo kiểu rõ ràng
        const ingredients: {
            code: string;
            consume: { s: number; m: number; l: number }
        }[] = [];

        // --- GROUP 1: CÀ PHÊ & CHOCOLATE ---
        if (
            cat.includes('coffee') ||
            cat.includes('espresso') ||
            cat.includes('americano') ||
            cat.includes('phin') ||
            cat.includes('cold brew') ||
            cat.includes('chocolate')
        ) {
            if (!cat.includes('chocolate')) {
                const beanCode = name.includes('arabica') || name.includes('latte') || name.includes('cappuccino')
                    ? 'mat_bean_arabica'
                    : 'mat_bean_robusta';
                ingredients.push({ code: beanCode, consume: { s: 20, m: 25, l: 30 } });
            } else {
                // Giả sử có bột choco, nếu chưa có thì Fallback bên dưới sẽ lo liệu nếu code này sai
                ingredients.push({ code: 'mat_powder_chocolate', consume: { s: 15, m: 20, l: 25 } });
            }

            if (name.includes('milk') || name.includes('latte') || name.includes('bac xiu') || cat.includes('chocolate')) {
                ingredients.push({ code: 'mat_milk_condensed', consume: { s: 30, m: 40, l: 50 } });
                ingredients.push({ code: 'mat_milk_fresh', consume: { s: 100, m: 150, l: 200 } });
            }
            if (name.includes('sugar') || name.includes('black')) {
                ingredients.push({ code: 'mat_syrup_sugar', consume: { s: 10, m: 15, l: 20 } });
            }
        }

        // --- GROUP 2: TRÀ & MATCHA ---
        else if (cat.includes('tea') || cat.includes('matcha')) {
            let teaCode = 'mat_tea_black';
            if (name.includes('oolong')) teaCode = 'mat_tea_oolong';
            if (name.includes('jasmine') || name.includes('fruit')) teaCode = 'mat_tea_jasmine';

            if (cat.includes('matcha') || name.includes('matcha')) {
                teaCode = 'mat_matcha_vn';
            }

            ingredients.push({ code: teaCode, consume: { s: 5, m: 7, l: 9 } });

            if (name.includes('milk') || cat.includes('matcha')) {
                ingredients.push({ code: 'mat_powder_creamer', consume: { s: 20, m: 30, l: 40 } });
            }
            if (name.includes('fruit') || name.includes('peach') || name.includes('lychee')) {
                ingredients.push({ code: 'mat_syrup_peach', consume: { s: 20, m: 30, l: 40 } });
            }
        }

        // --- GROUP 3: FRAPPE ---
        else if (cat.includes('frappe')) {
            ingredients.push({ code: 'mat_powder_frappe', consume: { s: 20, m: 25, l: 30 } });
            ingredients.push({ code: 'mat_milk_fresh', consume: { s: 50, m: 70, l: 100 } });
            ingredients.push({ code: 'mat_cream_whipping', consume: { s: 30, m: 30, l: 30 } });
        }

        // --- GROUP 4: TOPPING ---
        else if (cat.includes('topping')) {
            ingredients.push({ code: 'mat_top_pearl', consume: { s: 50, m: 50, l: 50 } });
        }

        // =================================================================
        // 🛡️ FALLBACK LOGIC (Đảm bảo 100% có công thức)
        // =================================================================

        // Kiểm tra xem nãy giờ có add được nguyên liệu nào không.
        // Nếu KHÔNG (ví dụ: Food, Bánh, hoặc món lạ chưa define), ta sẽ add Random.
        if (ingredients.length === 0) {
            // Logger.warn(`⚠️ Using Fallback Random Recipe for: ${productName} (${categoryName})`);

            // Danh sách các nguyên liệu "An toàn" (Chắc chắn có trong DB Material)
            // Tránh dùng nguyên liệu lạ kẻo lỗi Foreign Key
            const safeFallbackMaterials = [
                'mat_syrup_sugar', // Đường (Gần như món nào cũng có thể dính líu)
                'mat_milk_fresh',  // Sữa tươi
                'mat_water_ro',    // Nước lọc (Nếu bạn đã seed, nếu chưa thì bỏ dòng này)
            ];

            // Random lấy 1 món
            const randomCode = safeFallbackMaterials[Math.floor(Math.random() * safeFallbackMaterials.length)];

            // Add vào với số lượng tượng trưng
            ingredients.push({
                code: randomCode,
                consume: { s: 10, m: 10, l: 10 }
            });
        }

        return ingredients;
    };

    // =====================================================================
    // 3. EXECUTE SEEDING
    // =====================================================================
    let successCount = 0;

    for (const p of products) {
        if (!p.category) continue;

        // Check Exists
        const existingRecipe = await prisma.recipe.findUnique({
            where: { product_id: p.id },
        });
        if (existingRecipe) continue;

        // Generate (Số liệu ở đây là g, ml)
        const ingredientsList = generateIngredients(p.name, p.category.name);

        if (ingredientsList.length === 0) continue;

        // Create Recipe
        const recipe = await prisma.recipe.create({
            data: {
                Product: { connect: { id: p.id } },
            },
        });

        // Create Details with CONVERSION
        for (const ing of ingredientsList) {
            const material = getMaterial(ing.code);

            if (!material) continue;

            // Lấy đơn vị lưu kho (kg, l, g, ml...)
            const unitSymbol = material.Unit.symbol;

            // Nếu sản phẩm Multi-size (Đồ uống)
            if (p.is_multi_size) {
                await prisma.materialRecipe.createMany({
                    data: [
                        {
                            recipeId: recipe.id, materialId: material.id, sizeId: sizeS,
                            // Convert 20g -> 0.02kg
                            consume: convertToStorageUnit(ing.consume.s, unitSymbol)
                        },
                        {
                            recipeId: recipe.id, materialId: material.id, sizeId: sizeM,
                            consume: convertToStorageUnit(ing.consume.m, unitSymbol)
                        },
                        {
                            recipeId: recipe.id, materialId: material.id, sizeId: sizeL,
                            consume: convertToStorageUnit(ing.consume.l, unitSymbol)
                        },
                    ],
                });
            }
            // Sản phẩm Single-size (Topping)
            else {
                await prisma.materialRecipe.create({
                    data: {
                        recipeId: recipe.id,
                        materialId: material.id,
                        sizeId: null,
                        consume: convertToStorageUnit(ing.consume.m, unitSymbol)
                    },
                });
            }
        }
        successCount++;
    }

    Logger.log(`✅ Seeded Recipes for ${successCount} products (Converted to storage units)`);
    return prisma.recipe.findMany();
}


// seedRecipes()
//     .then(() => {
//         console.log('Done!');
//         prisma.$disconnect();
//     })
//     .catch((e) => {
//         console.error(e);
//         prisma.$disconnect();
//         process.exit(1);
//     });