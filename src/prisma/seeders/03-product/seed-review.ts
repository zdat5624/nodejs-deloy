import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedReviews() {
    Logger.log('🪄 Seeding Product Reviews (English Content)...');

    // 1. GET DATA
    const products = await prisma.product.findMany();

    // Filter users: exclude 'admin', 'owner', 'staff'
    // Logic: Users where NO role matches the excluded list
    const customers = await prisma.user.findMany({
        where: {
            roles: {
                none: {
                    role_name: {
                        in: ['admin', 'owner', 'staff'],
                    },
                },
            },
        },
    });

    if (customers.length === 0) {
        Logger.warn('⚠️ No customers found to seed reviews. Skipping.');
        return;
    }

    Logger.log(`ℹ️ Found ${customers.length} valid customers for reviewing.`);

    // 2. RICH COMMENT BANK (Coffee & Tea Context)
    const commentBank = {
        5: [
            "Absolutely delicious! The flavor is perfectly balanced.",
            "Hands down the best coffee I've had in a while.",
            "My go-to drink every morning. Highly recommended!",
            "The toppings were fresh and the tea was brewed perfectly.",
            "10/10! Super fast delivery and the drink was still cold.",
            "Can't get enough of this. The sweetness level is just right.",
            "Amazing quality! Worth every penny.",
            "Love the aroma. You can tell they use real ingredients.",
        ],
        4: [
            "Pretty good, but I wish there was a bit more foam.",
            "Tasty drink, but the delivery took a little longer than expected.",
            "I ordered 50% sugar and it was perfect. Good job!",
            "Nice flavor, but the ice melted a bit too fast.",
            "Solid choice. Will probably order again.",
            "The pearls (boba) were a bit too chewy for me, but the tea was great.",
            "Great packaging, no spills. The drink was decent.",
        ],
        3: [
            "It's okay. Nothing special compared to other shops.",
            "Average taste. Not bad, but not amazing either.",
            "A bit too watery for my liking.",
            "The drink is fine, but I think it's slightly overpriced.",
            "Just a standard drink. Met my expectations but didn't exceed them.",
        ],
        2: [
            "Too sweet even though I asked for 30% sugar.",
            "The coffee tasted burnt today. Disappointed.",
            "Too much ice, barely any drink left.",
            "Delivery was very slow, the ice had completely melted.",
            "Not what I expected based on the description.",
        ],
        1: [
            "Terrible experience. The milk tasted off.",
            "Never ordering this again. Complete waste of money.",
            "Wrong order received and the taste was bad.",
            "Tasted like chemicals. Do not recommend.",
            "Worst coffee I've ever had.",
        ],
    };

    // Helper: Pick random item
    const getRandomItem = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

    // Helper: Weighted Random Rating (Simulate realistic behavior: mostly positive)
    const getRandomRating = () => {
        const rand = Math.random();
        if (rand < 0.05) return 1; // 5% chance
        if (rand < 0.15) return 2; // 10% chance
        if (rand < 0.35) return 3; // 20% chance
        if (rand < 0.65) return 4; // 30% chance
        return 5;                  // 35% chance
    };

    let reviewCount = 0;

    // 3. EXECUTE SEEDING
    for (const product of products) {
        // Randomize number of reviews per product (0 to 8 reviews)
        const numberOfReviews = Math.floor(Math.random() * 9);

        // Shuffle customers to ensure randomness for this specific product
        const shuffledCustomers = [...customers].sort(() => 0.5 - Math.random());
        const selectedReviewers = shuffledCustomers.slice(0, numberOfReviews);

        for (const customer of selectedReviewers) {
            // Idempotency Check: Skip if this user already reviewed this product
            const existing = await prisma.productReview.findFirst({
                where: { userId: customer.id, productId: product.id }
            });

            if (existing) continue;

            const rating = getRandomRating();

            // 20% chance user leaves a rating WITHOUT a comment
            const hasComment = Math.random() > 0.2;
            const comment = hasComment ? getRandomItem(commentBank[rating]) : null;

            // Random date within the last 60 days
            const randomDate = new Date(Date.now() - Math.floor(Math.random() * 60 * 24 * 60 * 60 * 1000));

            await prisma.productReview.create({
                data: {
                    userId: customer.id,
                    productId: product.id,
                    rating: rating,
                    comment: comment,
                    createdAt: randomDate,
                    updatedAt: randomDate, // Set same as created
                },
            });

            reviewCount++;
        }
    }

    Logger.log(`✅ Seeded ${reviewCount} reviews for ${products.length} products.`);
}