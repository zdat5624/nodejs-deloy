import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Start fixing gender (sex) data...');

    // Chúng ta sẽ update bảng "user_details" (tên trong DB do @map)
    // Sử dụng hàm LOWER(sex) để chuyển hết về chữ thường
    const count = await prisma.$executeRawUnsafe(`
    UPDATE "user_details"
    SET sex = LOWER(sex)
    WHERE sex IN ('Male', 'Female');
  `);

    console.log(`✅ Success! Fixed ${count} user details.`);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });