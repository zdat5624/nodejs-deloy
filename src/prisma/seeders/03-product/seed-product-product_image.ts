import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient();

function getFileName(item: { name: string; price: number; img: string }, index: number) {
    if (!item.img) return `${index}-error.jpg`;
    const ext = path.extname(item.img) || ".jpg";
    const slug = slugify(`${item.name}-${item.price}`);
    return `${index}-${slug}${ext}`;
}

// Tạo slug đẹp cho tên ảnh
function slugify(name: string) {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function getRandomItems<T>(arr: T[], count: number): T[] {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

export async function seedProducts() {
    Logger.log('🪄 Seeding Products (Menu: Coffee, Tea & Food)...');

    // 1. CHECK EXISTENCE
    const count = await prisma.product.count();
    if (count > 0) {
        Logger.log('⚠️ Products already exist → Skip');
        return prisma.product.findMany();
    }

    // ====================================================
    // 2. PREPARE DATA
    // ====================================================

    // a. Get Categories
    const categories = await prisma.category.findMany();
    const getCatId = (name: string) => {
        // Map HTML category codes/names to DB Category Names (English)
        const mapping: Record<string, string> = {
            // --- COFFEE ---
            'ESPRESSO': 'Espresso',
            'AMERICANO': 'Americano',
            'LATTE': 'Latte',
            'FRAPPE': 'Frappe',
            'PHIN': 'Vietnamese Phin Coffee',
            'COLD BREW': 'Cold Brew',
            // --- TEA ---
            'MATCHA TÂY BẮC': 'Northwest Matcha',
            'MATCHA KYOTO': 'Kyoto Matcha',
            'TRÀ TRÁI CÂY': 'Fruit Tea',
            'TRÀ SỮA': 'Milk Tea',
            'CHOCOLATE': 'Chocolate',
            // --- FOOD ---
            'BÁNH NGỌT': 'Sweet Pastries', // Map Vietnamese HTML key
            'BÁNH MẶN': 'Savory Pastries',   // Map Vietnamese HTML key
            // --- TOPPING ---
            'TOPPING': 'Topping',
        };

        // Logic: Find the DB name based on the input key
        const upperName = name.toUpperCase();
        const dbName = Object.keys(mapping).find(key => upperName.includes(key))
            ? mapping[Object.keys(mapping).find(key => upperName.includes(key))!]
            : name;

        const cat = categories.find((c) => c.name.toLowerCase() === dbName.toLowerCase());
        if (!cat) Logger.warn(`⚠️ Category '${name}' (Mapped to: ${dbName}) not found!`);
        return cat?.id || null;
    };

    // b. Get Sizes
    const sizes = await prisma.size.findMany();
    const sizeS = sizes.find((s) => s.name === 'S');
    const sizeM = sizes.find((s) => s.name === 'M');
    const sizeL = sizes.find((s) => s.name === 'L');

    if (!sizeS || !sizeM || !sizeL) {
        Logger.error('❌ Missing sizes (S, M, L). Please seed Sizes first.');
        return;
    }

    // c. Get Options
    const sugarGroup = await prisma.optionGroup.findFirst({ where: { name: 'Sugar Level' }, include: { values: true } });
    const iceGroup = await prisma.optionGroup.findFirst({ where: { name: 'Ice Level' }, include: { values: true } });
    const commonOptionIds = [...(sugarGroup?.values.map((v) => v.id) || []), ...(iceGroup?.values.map((v) => v.id) || [])];

    // ====================================================
    // 3. SEED TOPPINGS
    // ====================================================
    Logger.log('   ...Creating Toppings');
    const toppingsData = [
        { name: 'Milk Cream', price: 15000, cat: 'Topping', image: 'top-milk-cream.png' },
        { name: 'Black Pearl', price: 10000, cat: 'Topping', image: 'top-black-pearl.png' },
        { name: 'White Pearl', price: 10000, cat: 'Topping', image: 'top-white-pearl.png' },
        { name: 'Red Bean', price: 10000, cat: 'Topping', image: 'top-red-bean.png' },
        { name: 'Grass Jelly', price: 10000, cat: 'Topping', image: 'top-grass-jelly.png' },
        { name: 'Coconut Jelly', price: 10000, cat: 'Topping', image: 'top-coconut-jelly.png' },
        { name: 'Pudding', price: 10000, cat: 'Topping', image: 'top-pudding.png' },
    ];

    const createdToppingIds: number[] = [];
    for (const t of toppingsData) {
        const catId = getCatId(t.cat);
        if (!catId) continue;
        const product = await prisma.product.create({
            data: {
                name: t.name, is_multi_size: false, price: t.price, isTopping: true, isActive: true,
                product_detail: `Elevate your drink experience with our premium ${t.name}. A fun and tasty addition to any beverage!`,
                category: { connect: { id: catId } },
                images: { create: [{ image_name: t.image, sort_index: 1 }] },
            },
        });
        createdToppingIds.push(product.id);
    }

    // ====================================================
    // 4. SEED BEVERAGES (COFFEE & TEA)
    // ====================================================
    Logger.log('   ...Creating Beverages');

    const productList = [
        // --- COFFEE & TEA DATA (Giữ nguyên từ bước trước) ---
        { name: 'Hot Espresso', price: 45000, cat: 'ESPRESSO', img: '//cdn.hstatic.net/products/1000075078/espresso_shot_ce837696dded42d4a3135d9302b68f31_grande.png' },
        { name: 'Iced Espresso', price: 49000, cat: 'ESPRESSO', img: '//cdn.hstatic.net/products/1000075078/espresso_da_589e3a4d46e94f72b26752ee64b93e7b_grande.png' },
        { name: 'Classic Americano', price: 39000, cat: 'AMERICANO', img: '//cdn.hstatic.net/products/1000075078/a-me_classic_dfbdc3b2b0124ca7bb3b177fb12871c1_grande.png' },
        { name: 'Peach Americano', price: 49000, cat: 'AMERICANO', img: '//cdn.hstatic.net/products/1000075078/a-me_dao_ace66054e028494cbe99a8d610b7e20a_grande.png' },
        { name: 'Apricot Americano', price: 49000, cat: 'AMERICANO', img: '//cdn.hstatic.net/products/1000075078/a-me_mo_12544504de6947ae9090b070228d4613_grande.png' },
        { name: 'Yuzu Americano', price: 49000, cat: 'AMERICANO', img: '//cdn.hstatic.net/products/1000075078/americano_thanh_yen_35e4c9612d944fab83c2a386f8d72cab_grande.png' },
        { name: 'Hot Americano', price: 45000, cat: 'AMERICANO', img: '//cdn.hstatic.net/products/1000075078/americano_nong_785ea48734b741858eaae04501a36fa5_grande.png' },
        { name: 'Almond Latte', price: 59000, cat: 'LATTE', img: '//cdn.hstatic.net/products/1000075078/latte_hanh_nhan_da07f889facd45daae1b0d958820fc74_grande.png' },
        { name: 'Caramel Cold Foam Latte', price: 59000, cat: 'LATTE', img: '//cdn.hstatic.net/products/1000075078/latte_caremel_cold_foam_e1245abc921241a5868fa2ab137e17a8_grande.png' },
        { name: 'Classic Latte', price: 55000, cat: 'LATTE', img: '//product.hstatic.net/1000075078/product/1746439218_latte-classic_e216596a8267420b9e55714322ac2d8f_grande.png' },
        { name: 'Bac Xiu Latte', price: 49000, cat: 'LATTE', img: '//product.hstatic.net/1000075078/product/1746441267_latte-bac-xiu_a6fe420fef6f4ec7a2e4f87e9e03ef4b_grande.png' },
        { name: 'Hazelnut Latte', price: 59000, cat: 'LATTE', img: '//product.hstatic.net/1000075078/product/1746441372_halzenut-latte_3ef994056c3b4765a600e853f6cca72d_grande.png' },
        { name: 'Hot Latte', price: 59000, cat: 'LATTE', img: '//cdn.hstatic.net/products/1000075078/latte_nong_77d6c8dd1ce84d0f900f83d99f069557_grande.png' },
        { name: 'Iced Cappuccino', price: 55000, cat: 'LATTE', img: '//cdn.hstatic.net/products/1000075078/cappucino_da_691da3dddf5744d698974dd6596677bc_grande.png' },
        { name: 'Hot Cappuccino', price: 55000, cat: 'LATTE', img: '//cdn.hstatic.net/products/1000075078/cappucino_nong_fa141e298bc843d8a934a720189bf3e2_grande.png' },
        { name: 'Iced Caramel Macchiato', price: 65000, cat: 'LATTE', img: '//cdn.hstatic.net/products/1000075078/caramel_macchiato_da_5549b94596d94133973b97ea2d04d735_grande.png' },
        { name: 'Hot Caramel Macchiato', price: 69000, cat: 'LATTE', img: '//cdn.hstatic.net/products/1000075078/caramel_macchiato_nong_19dcb8fe095f44e58c844f96340db62a_grande.png' },
        { name: 'Floaty Vanilla Mocha', price: 65000, cat: 'FRAPPE', img: '//cdn.hstatic.net/products/1000075078/floaty_vanilla_mocha_83431b5e73b84af1b63eba443e3d9cd6_grande.png' },
        { name: 'Floaty Bac Xiu', price: 65000, cat: 'FRAPPE', img: '//cdn.hstatic.net/products/1000075078/floaty_bac_xiu_95a5922c4eb24f43a9cf72e7df305f73_grande.png' },
        { name: 'Floaty Matcha Latte', price: 65000, cat: 'FRAPPE', img: '//cdn.hstatic.net/products/1000075078/floaty_matcha_latte_1a4578d4b30d49d0bb43354842efbcc1_grande.png' },
        { name: 'Northwest Matcha Frappe', price: 65000, cat: 'FRAPPE', img: '//product.hstatic.net/1000075078/product/1746441845_matcha-frappe_bc025cb542b146d1aadbd91fe61c6f09_grande.png' },
        { name: 'Choco-chip Frappe', price: 65000, cat: 'FRAPPE', img: '//product.hstatic.net/1000075078/product/1746460836_choco-chip-frappe_81622b7415704acdb45538b7c621acab_grande.png' },
        { name: 'Coconut Foam Bac Xiu', price: 45000, cat: 'PHIN', img: '//cdn.hstatic.net/products/1000075078/bac_xiu_foam_dua_4d84183a347145be99edbdd844bf17f8_grande.png' },
        { name: 'Salted Caramel Bac Xiu', price: 45000, cat: 'PHIN', img: '//cdn.hstatic.net/products/1000075078/bac_xiu_caramel_muoi_4a995a0bfa5d420ab90dc28b714b5bf5_grande.png' },
        { name: 'Bac Xiu', price: 39000, cat: 'PHIN', img: '//cdn.hstatic.net/products/1000075078/bac_xiu_truyen_thong_2694ea6d85c047fa9a559c2a85f0e766_grande.png' },
        { name: 'Hot Bac Xiu', price: 39000, cat: 'PHIN', img: '//cdn.hstatic.net/products/1000075078/bac_xiu_truyen_thong_nong_3cf582dc460a422b939c62f86e41ee4e_grande.png' },
        { name: 'Hot Black Coffee', price: 39000, cat: 'PHIN', img: '//cdn.hstatic.net/products/1000075078/ca_phe_phin_den_nong_841bd93375e64d0ba7f4067770fdbd44_grande.png' },
        { name: 'Hot Milk Coffee', price: 39000, cat: 'PHIN', img: '//cdn.hstatic.net/products/1000075078/ca_phe_phin_nau_nong_249262a0d36a4861932e17efb9706d13_grande.png' },
        { name: 'Iced Black Coffee', price: 39000, cat: 'PHIN', img: '//cdn.hstatic.net/products/1000075078/ca_phe_phin_den_da_66c9be0094354e8693117543770b2661_grande.png' },
        { name: 'Iced Milk Coffee', price: 39000, cat: 'PHIN', img: '//cdn.hstatic.net/products/1000075078/ca_phe_phin_nau_da_73fed306bafb4f87b4cb44573c900388_grande.png' },
        { name: 'Classic Cold Brew', price: 45000, cat: 'COLD BREW', img: '//cdn.hstatic.net/products/1000075078/cold_brew_truyen_thong_7d8799b543124cc7946a9701ba30b149_grande.png' },
        { name: 'Kumquat Cold Brew', price: 49000, cat: 'COLD BREW', img: '//cdn.hstatic.net/products/1000075078/cold_brew_kim_quat_95ae6104aa86446aa7d2185c9f06e0bf_grande.png' },
        { name: 'Northwest Matcha Latte', price: 45000, cat: 'MATCHA TÂY BẮC', img: '//cdn.hstatic.net/products/1000075078/matcha_latte_tay_bac_da_d5ba2ffade1e4917ab810e626805bc18_grande.png' },
        { name: 'Hot Northwest Matcha Latte', price: 49000, cat: 'MATCHA TÂY BẮC', img: '//cdn.hstatic.net/products/1000075078/matcha_latte_tay_bac_nong_d591c8251dc64fb987118a408e861b09_grande.png' },
        { name: 'Hot Oat Milk Northwest Matcha Latte', price: 55000, cat: 'MATCHA TÂY BẮC', img: '//cdn.hstatic.net/products/1000075078/matcha_latte_tay_bac_yen_mach_nong_3c7728e6b1a34ba0b735ae95fa789c61_grande.png' },
        { name: 'Iced Oat Milk Northwest Matcha Latte', price: 55000, cat: 'MATCHA TÂY BẮC', img: '//cdn.hstatic.net/products/1000075078/matcha_latte_tay_bac_yen_mach_da_947c966556b940ec8c867b20e3165112_grande.png' },
        { name: 'Matcha Latte', price: 55000, cat: 'MATCHA TÂY BẮC', img: '//product.hstatic.net/1000075078/product/1745246722_matcha-latte_805657f9e18948e6a6218bbce3e8fbe4_grande.png' },
        { name: 'Northwest Matcha with Golden Pearl', price: 49000, cat: 'MATCHA TÂY BẮC', img: '//product.hstatic.net/1000075078/product/1745246677_matcha-dao-copy_ab2fbd66086240d7a49804ee1d317cbf_grande.png' },
        { name: 'Kyoto Matcha Latte', price: 55000, cat: 'MATCHA KYOTO', img: '//product.hstatic.net/1000075078/product/1745246722_matcha-latte_805657f9e18948e6a6218bbce3e8fbe4_grande.png' },
        { name: 'Hot Peach Tea with Lemongrass', price: 59000, cat: 'TRÀ TRÁI CÂY', img: '//product.hstatic.net/1000075078/product/1737356382_oolong-tu-quy-sen-nong-copy_79b957510bcb4e6f8bb7d938f0448ab9_grande.png' },
        { name: 'Iced Peach Tea with Lemongrass', price: 49000, cat: 'TRÀ TRÁI CÂY', img: '//product.hstatic.net/1000075078/product/1737356280_tra-dao-cam-sa_9c46cceef5004e689b746e8ec0e47c34_grande.png' },
        { name: 'Hot Oolong Lotus Tea', price: 59000, cat: 'TRÀ TRÁI CÂY', img: '//cdn.hstatic.net/products/1000075078/oolong_tu_quy_sen_nong_eb6f855cb05a423cbce31805f4a09dab_grande.png' },
        { name: 'Iced Oolong Lotus Tea', price: 49000, cat: 'TRÀ TRÁI CÂY', img: '//cdn.hstatic.net/products/1000075078/oolong_tu_quy_sen_da_45f85b5cedf64902b2a85fb969372d82_grande.png' },
        { name: 'Roasted Oolong Milk Tea with Grass Jelly', price: 55000, cat: 'TRÀ SỮA', img: '//cdn.hstatic.net/products/1000075078/tra_sua_oolong_nuong_suong_sao_95c0a6f5fd9c4343a88505ca3e699015_grande.png' },
        { name: 'Oolong Four Seasons Milk Tea with Grass Jelly', price: 55000, cat: 'TRÀ SỮA', img: '//cdn.hstatic.net/products/1000075078/tra_sua_oolong_tu_quy_suong_sao_99957a3486db42ecbf507cc59210e3c0_grande.png' },
        { name: 'Hot Black Milk Tea', price: 55000, cat: 'TRÀ SỮA', img: '//cdn.hstatic.net/products/1000075078/hong_tra_sua_nong_3e93c4b96fe040fd809e0260828afc95_grande.png' },
        { name: 'Black Milk Tea with Pearls', price: 55000, cat: 'TRÀ SỮA', img: '//cdn.hstatic.net/products/1000075078/hong_tra_sua_tran_chau_7f0f8a483cac43c5b22f9eeade9a847b_grande.png' },
        { name: 'Black Tea Macchiato', price: 55000, cat: 'TRÀ SỮA', img: '//cdn.hstatic.net/products/1000075078/tra_den_macchiato_87937ed75a234e51a6a0e5fac3a711e6_grande.png' },
        { name: 'Oolong Blao Milk Tea', price: 39000, cat: 'TRÀ SỮA', img: '//cdn.hstatic.net/products/1000075078/tra_sua_oolong_blao_c534df6c04ec4566a04d3a1efd9e27ce_grande.png' },
        { name: 'Iced Chocolate', price: 55000, cat: 'CHOCOLATE', img: '//product.hstatic.net/1000075078/product/1737355560_chocolate-da_93e902464187494a8d309db309796206_grande.png' },
        { name: 'Hot Chocolate', price: 55000, cat: 'CHOCOLATE', img: '//product.hstatic.net/1000075078/product/1737355571_chocolate-nong_c7331fe6900b403c83633a435f3527ac_grande.png' },
    ];

    let index = 0;

    for (const p of productList) {
        const catId = getCatId(p.cat);
        if (!catId) continue;

        const fileName = getFileName(p, index);

        const sizesCreateData = [
            { size_id: sizeS.id, price: p.price },
            { size_id: sizeM.id, price: p.price + 6000 },
            { size_id: sizeL.id, price: p.price + 10000 },
        ];

        // 👉 Random 2–4 topping
        const randomToppings = getRandomItems(
            createdToppingIds,
            Math.floor(Math.random() * 3) + 2
        );

        await prisma.product.create({
            data: {
                name: p.name,
                is_multi_size: true,
                price: null,
                product_detail: `Experience the rich and authentic flavor of ${p.name}. Crafted with passion by CoffeeTek baristas to brighten your day.`,
                isTopping: false,
                isActive: true,
                category: { connect: { id: catId } },
                sizes: { create: sizesCreateData.map((s) => ({ size_id: s.size_id, price: s.price })) },
                optionValues: { create: commonOptionIds.map((id) => ({ option_value_id: id })) },

                // 👉 Random topping
                toppings: {
                    create: randomToppings.map((id) => ({
                        topping_id: id
                    })),
                },

                images: { create: [{ image_name: fileName, sort_index: 1 }] },
            },
        });
        index++;
    }

    // ====================================================
    // 5. SEED FOOD (REAL DATA)
    // ====================================================

    const foodList = [
        // --- SWEET PASTRIES ---
        { name: 'Condensed Milk Butter Croissant', price: 35000, cat: 'BÁNH NGỌT', img: '//product.hstatic.net/1000075078/product/1737355374_croissant-sua-dac_6c48c99afd904d78b81e821df12a1dba_grande.png' },
        { name: 'Matcha Burnt Cheesecake', price: 55000, cat: 'BÁNH NGỌT', img: '//product.hstatic.net/1000075078/product/1743674607_matcha-burnt-cheesecake_2b4a68367fb64d0fb9bb7eed5ca116f7_grande.png' },
        { name: 'Burnt Cheesecake', price: 55000, cat: 'BÁNH NGỌT', img: '//product.hstatic.net/1000075078/product/1743674500_burnt-cheesecake_3ca2f1483b034c3a9192a07e6b2f3b81_grande.png' },
        { name: 'Dried Jackfruit', price: 20000, cat: 'BÁNH NGỌT', img: '//product.hstatic.net/1000075078/product/1737355404_mit-say_9875ab69144b4fcc9d07535bfb58c92d_grande.png' },
        { name: 'Milk Tea Pearl Mochi', price: 19000, cat: 'BÁNH NGỌT', img: '//product.hstatic.net/1000075078/product/1737355411_mochi-tra-sua_5950a2ce430440d5bbe33527b7e10021_grande.png' },
        { name: 'Raspberry Mochi', price: 19000, cat: 'BÁNH NGỌT', img: '//product.hstatic.net/1000075078/product/1737355355_mochi-phuc-bon-tu_ac9e0f60acbf43f89a7f6b1a0bcc743c_grande.png' },
        { name: 'Blueberry Mochi', price: 19000, cat: 'BÁNH NGỌT', img: '//product.hstatic.net/1000075078/product/1737355361_mochi-viet-quat_059d54c9074b4ad89f8a27eff9e3e709_grande.png' },
        { name: 'Chocolate Mochi', price: 19000, cat: 'BÁNH NGỌT', img: '//product.hstatic.net/1000075078/product/1737355348_mochi-choco_625d69b4f92d4cb3b2814bcb24a094ba_grande.png' },
        { name: 'Matcha Mochi', price: 19000, cat: 'BÁNH NGỌT', img: '//product.hstatic.net/1000075078/product/1737355341_mochi-matcha_c8c0db21b77349b0adb23bd6ff0da2a2_grande.png' },
        { name: 'Tiramisu Mousse', price: 35000, cat: 'BÁNH NGỌT', img: '//product.hstatic.net/1000075078/product/1737355334_tiramisu_02b51263d15e419aa7da19528c369fa3_grande.png' },
        { name: 'Chocolate Bear Mousse', price: 39000, cat: 'BÁNH NGỌT', img: '//product.hstatic.net/1000075078/product/1737355325_mouse-gau-choco_5955c2483e1c47ad923d5fb402aa038e_grande.png' },

        // --- SAVORY PASTRIES ---
        { name: 'Butter Croissant', price: 29000, cat: 'BÁNH MẶN', img: '//product.hstatic.net/1000075078/product/1737355250_croissant_edd90f1e46f84bcb978bdfc6a0fa0141_grande.png' },
        { name: 'Spicy Butter Cheese Floss Bread Stick', price: 22000, cat: 'BÁNH MẶN', img: '//product.hstatic.net/1000075078/product/1737355270_bmq-cha-bong-pm_34e407eef2a947f28c6e9892e47b3f68_grande.png' },
        { name: 'Beef Mushroom Butter Sauce Bread Stick', price: 22000, cat: 'BÁNH MẶN', img: '//product.hstatic.net/1000075078/product/1737355257_bmq-bo-nam_160a1e2a36b14f89b3ef0c61cda229ad_grande.png' },
        { name: 'Pate Bread Stick', price: 19000, cat: 'BÁNH MẶN', img: '//product.hstatic.net/1000075078/product/1737355276_bmq-pate-hai-phong_8e0d00ff7cf44d4e9eb504948ed4697c_grande.png' },
        { name: 'Salted Egg Croissant', price: 39000, cat: 'BÁNH MẶN', img: '//product.hstatic.net/1000075078/product/1737355222_croissant-trung-muoi_9df010a37f134f2d9510881b5b7f082e_grande.png' },
        { name: 'Cheese Pork Floss Bun', price: 39000, cat: 'BÁNH MẶN', img: '//product.hstatic.net/1000075078/product/1737355233_bami-cha-bong-pho-mai_9a05ef95cc8649b6b9292a027f5208dd_grande.png' },
    ];

    for (const f of foodList) {
        const catId = getCatId(f.cat);
        if (!catId) continue;

        const fileName = getFileName(f, index);

        await prisma.product.create({
            data: {
                name: f.name,
                is_multi_size: false,
                price: f.price,
                product_detail: `Indulge in the delightful taste of our freshly prepared ${f.name}. The perfect sweet or savory companion for your favorite drink.`,
                isTopping: false,
                isActive: true,
                category: { connect: { id: catId } },
                images: { create: [{ image_name: fileName, sort_index: 1 }] },
            },
        });
        index++;
    }

    Logger.log(`✅ Seeded Products successfully`);
    return prisma.product.findMany();
}