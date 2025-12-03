import { PrismaClient, Category, Role, Size, Unit } from '@prisma/client';
import * as argon from 'argon2';
import { Logger } from '@nestjs/common';
import { seedUsers } from './seeders/02-user/seed-user-user_detail';
import { seedOptionGroups } from './seeders/01-base/seed-option-group_option-value';
import { seedPaymentMethods } from './seeders/01-base/seed-payment-method';
import { seedRoles } from './seeders/01-base/seed-role';
import { seedSizes } from './seeders/01-base/seed-size';
import { seedInventory } from './seeders/01-base/seed-unit-unitConversion-material';
import { seedUserAddresses } from './seeders/02-user/seed-user-address';
import { seedCategories } from './seeders/03-product/seed-category';
import { seedProducts } from './seeders/03-product/seed-product-product_image';
import { seedRecipes } from './seeders/03-product/seed-recipe-recipe_material';
import { seedMaterialImportations } from './seeders/04-inventory/seed-material-importation';
import { seedMaterialRemain } from './seeders/04-inventory/seed-material-remain';
import { seedCustomerPoints } from './seeders/05-customer/seed-customer-point';
import { seedLoyalLevels } from './seeders/05-customer/seed-loyal-level';
import { seedPromotions } from './seeders/05-customer/seed-promotion';
import { seedVouchers } from './seeders/05-customer/seed-voucher';
import { seedOrders } from './seeders/06-order/seed-order';
import { seedReviews } from './seeders/03-product/seed-review';

const prisma = new PrismaClient();
const logger = new Logger('PrismaSeed');


/**
 * Main seed function
 */
async function main() {
  logger.log('🚀 Start seeding...');

  // 1
  await seedOptionGroups();
  await seedPaymentMethods();
  await seedRoles();
  await seedSizes();
  await seedInventory();

  // 2
  await seedUsers();
  await seedUserAddresses();


  // 3
  await seedCategories();
  await seedProducts();
  await seedRecipes();
  await seedReviews();

  // 4
  await seedMaterialImportations();
  await seedMaterialRemain();

  // 5
  await seedLoyalLevels();
  await seedCustomerPoints();
  await seedPromotions();
  await seedVouchers();

  // 6
  await seedOrders();


  logger.log('🏁 Seeding finished.');
}

// --- Execute ---
main()
  .catch((e) => {
    logger.error('❌ Seeding failed');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });