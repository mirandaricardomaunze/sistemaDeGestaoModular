import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'mirandamaunze122@gmail.com';
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            company: {
                include: {
                    modules: {
                        include: {
                            module: true
                        }
                    }
                }
            }
        }
    });

    console.log(JSON.stringify(user, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
