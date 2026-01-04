import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedMultiCompanyData() {
    try {
        console.log('🌱 Iniciando carregamento de dados multiempresa...\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // ==========================================================================
        // 1. CRIAR MÓDULOS
        // ==========================================================================
        console.log('📦 Criando módulos de negócio...');
        const modules = [
            { code: 'PHARMACY', name: 'Farmácia', description: 'Gestão completa de farmácia', icon: 'HiOutlineBeaker', color: '#10B981' },
            { code: 'COMMERCIAL', name: 'Comércio', description: 'Solução comercial', icon: 'HiOutlineShoppingCart', color: '#3B82F6' },
            { code: 'BOTTLE_STORE', name: 'Garrafeira', description: 'Gestão de bebidas', icon: 'HiOutlineBuildingStorefront', color: '#8B5CF6' },
            { code: 'HOTEL', name: 'Hotelaria', description: 'Gestão hoteleira', icon: 'HiOutlineHomeModern', color: '#F59E0B' },
            { code: 'RESTAURANT', name: 'Restaurante', description: 'Gestão de restaurante', icon: 'HiOutlineCake', color: '#EF4444' },
            { code: 'LOGISTICS', name: 'Logística', description: 'Gestão de logística', icon: 'HiOutlineTruck', color: '#6366F1' },
        ];

        const createdModules: any = {};
        for (const mod of modules) {
            const module = await prisma.module.upsert({
                where: { code: mod.code },
                update: {},
                create: mod
            });
            createdModules[mod.code] = module;
        }
        console.log(`✅ ${modules.length} módulos criados\n`);

        // ==========================================================================
        // 2. CRIAR ROLES
        // ==========================================================================
        console.log('👥 Criando roles RBAC...');
        const roles = [
            { code: 'company_admin', name: 'Administrador da Empresa', description: 'Acesso total', isSystem: true },
            { code: 'module_admin', name: 'Administrador de Módulo', description: 'Gestão de módulo', isSystem: true },
            { code: 'module_operator', name: 'Operador', description: 'Operações diárias', isSystem: true },
        ];

        const createdRoles: any = {};
        for (const role of roles) {
            const r = await prisma.role.upsert({
                where: { code: role.code },
                update: {},
                create: role
            });
            createdRoles[role.code] = r;
        }
        console.log(`✅ ${roles.length} roles criados\n`);

        // ==========================================================================
        // 3. CRIAR EMPRESAS
        // ==========================================================================
        console.log('🏢 Criando empresas...');

        // EMPRESA 1: Farmácia Central
        const farmacia = await prisma.company.upsert({
            where: { nuit: '100000001' },
            update: {},
            create: {
                name: 'Farmácia Central',
                tradeName: 'Farmácia Central Lda',
                nuit: '100000001',
                phone: '+258 84 123 4567',
                email: 'geral@farmaciacentral.co.mz',
                address: 'Av. Julius Nyerere, 1234',
                businessType: 'pharmacy',
                status: 'active'
            }
        });

        // Associar módulo PHARMACY à Farmácia Central
        await prisma.companyModule.upsert({
            where: {
                companyId_moduleId: {
                    companyId: farmacia.id,
                    moduleId: createdModules['PHARMACY'].id
                }
            },
            update: {},
            create: {
                companyId: farmacia.id,
                moduleId: createdModules['PHARMACY'].id,
                isActive: true
            }
        });

        // EMPRESA 2: Supermercado Maputo
        const supermercado = await prisma.company.upsert({
            where: { nuit: '200000002' },
            update: {},
            create: {
                name: 'Supermercado Maputo',
                tradeName: 'Supermercado Maputo SARL',
                nuit: '200000002',
                phone: '+258 84 234 5678',
                email: 'info@supermaputo.co.mz',
                address: 'Av. 24 de Julho, 567',
                businessType: 'retail',
                status: 'active'
            }
        });

        // Associar módulo COMMERCIAL ao Supermercado
        await prisma.companyModule.upsert({
            where: {
                companyId_moduleId: {
                    companyId: supermercado.id,
                    moduleId: createdModules['COMMERCIAL'].id
                }
            },
            update: {},
            create: {
                companyId: supermercado.id,
                moduleId: createdModules['COMMERCIAL'].id,
                isActive: true
            }
        });

        // EMPRESA 3: Hotel Polana
        const hotel = await prisma.company.upsert({
            where: { nuit: '300000003' },
            update: {},
            create: {
                name: 'Hotel Polana',
                tradeName: 'Hotel Polana SA',
                nuit: '300000003',
                phone: '+258 84 345 6789',
                email: 'reservas@hotelpolana.co.mz',
                address: 'Av. Marginal, 890',
                businessType: 'hotel',
                status: 'active'
            }
        });

        // Associar módulo HOTEL ao Hotel Polana
        await prisma.companyModule.upsert({
            where: {
                companyId_moduleId: {
                    companyId: hotel.id,
                    moduleId: createdModules['HOTEL'].id
                }
            },
            update: {},
            create: {
                companyId: hotel.id,
                moduleId: createdModules['HOTEL'].id,
                isActive: true
            }
        });

        console.log('✅ 3 empresas criadas\n');

        // ==========================================================================
        // 4. CRIAR UTILIZADORES
        // ==========================================================================
        console.log('👤 Criando utilizadores...');

        const hashedPassword = await bcrypt.hash('senha123', 12);

        // Usuário Farmácia
        const userFarmacia = await prisma.user.upsert({
            where: { email: 'admin@farmaciacentral.co.mz' },
            update: {},
            create: {
                email: 'admin@farmaciacentral.co.mz',
                password: hashedPassword,
                name: 'João Silva',
                role: 'admin',
                phone: '+258 84 111 1111',
                isActive: true,
                companyId: farmacia.id
            }
        });

        const existingRoleFarmacia = await prisma.userModuleRole.findFirst({
            where: {
                userId: userFarmacia.id,
                roleId: createdRoles['company_admin'].id
            }
        });

        if (!existingRoleFarmacia) {
            await prisma.userModuleRole.create({
                data: {
                    userId: userFarmacia.id,
                    roleId: createdRoles['company_admin'].id
                }
            });
        }

        // Usuário Supermercado
        const userSuper = await prisma.user.upsert({
            where: { email: 'admin@supermaputo.co.mz' },
            update: {},
            create: {
                email: 'admin@supermaputo.co.mz',
                password: hashedPassword,
                name: 'Maria Santos',
                role: 'admin',
                phone: '+258 84 222 2222',
                isActive: true,
                companyId: supermercado.id
            }
        });

        const existingRoleSuper = await prisma.userModuleRole.findFirst({
            where: {
                userId: userSuper.id,
                roleId: createdRoles['company_admin'].id
            }
        });

        if (!existingRoleSuper) {
            await prisma.userModuleRole.create({
                data: {
                    userId: userSuper.id,
                    roleId: createdRoles['company_admin'].id
                }
            });
        }

        // Usuário Hotel
        const userHotel = await prisma.user.upsert({
            where: { email: 'admin@hotelpolana.co.mz' },
            update: {},
            create: {
                email: 'admin@hotelpolana.co.mz',
                password: hashedPassword,
                name: 'Carlos Machado',
                role: 'admin',
                phone: '+258 84 333 3333',
                isActive: true,
                companyId: hotel.id
            }
        });

        const existingRoleHotel = await prisma.userModuleRole.findFirst({
            where: {
                userId: userHotel.id,
                roleId: createdRoles['company_admin'].id
            }
        });

        if (!existingRoleHotel) {
            await prisma.userModuleRole.create({
                data: {
                    userId: userHotel.id,
                    roleId: createdRoles['company_admin'].id
                }
            });
        }

        console.log('✅ 3 utilizadores criados\n');

        // ==========================================================================
        // 5. CRIAR ARMAZÉNS
        // ==========================================================================
        console.log('📦 Criando armazéns...');

        const warehouseFarmacia = await prisma.warehouse.upsert({
            where: { code: 'WH-FARM-001' },
            update: {},
            create: {
                code: 'WH-FARM-001',
                name: 'Armazém Farmácia Central',
                location: 'Maputo',
                responsible: 'João Silva',
                isDefault: true,
                companyId: farmacia.id
            }
        });

        const warehouseSuper = await prisma.warehouse.upsert({
            where: { code: 'WH-SUPER-001' },
            update: {},
            create: {
                code: 'WH-SUPER-001',
                name: 'Armazém Supermercado',
                location: 'Maputo',
                responsible: 'Maria Santos',
                isDefault: true,
                companyId: supermercado.id
            }
        });

        console.log('✅ 2 armazéns criados\n');

        // ==========================================================================
        // 6. CRIAR CATEGORIAS
        // ==========================================================================
        console.log('📂 Criando categorias...');

        const categoriasFarmacia = [
            { code: 'CAT-MED-001', name: 'Medicamentos', color: '#10B981', companyId: farmacia.id },
            { code: 'CAT-VIT-001', name: 'Vitaminas', color: '#F59E0B', companyId: farmacia.id },
            { code: 'CAT-COS-001', name: 'Cosméticos', color: '#EC4899', companyId: farmacia.id },
        ];

        const categoriasSuper = [
            { code: 'CAT-ALIM-001', name: 'Alimentação', color: '#22C55E', companyId: supermercado.id },
            { code: 'CAT-BEB-001', name: 'Bebidas', color: '#3B82F6', companyId: supermercado.id },
            { code: 'CAT-LIMP-001', name: 'Limpeza', color: '#F59E0B', companyId: supermercado.id },
        ];

        for (const cat of [...categoriasFarmacia, ...categoriasSuper]) {
            await prisma.category.upsert({
                where: { code: cat.code },
                update: {},
                create: cat
            });
        }

        console.log('✅ 6 categorias criadas\n');

        // ==========================================================================
        // 7. CRIAR FORNECEDORES
        // ==========================================================================
        console.log('🏭 Criando fornecedores...');

        const fornecedorFarmacia = await prisma.supplier.upsert({
            where: { code: 'FOR-FARM-001' },
            update: {},
            create: {
                code: 'FOR-FARM-001',
                name: 'Medimoc Farmacêutica',
                tradeName: 'Medimoc Lda',
                nuit: '400000001',
                phone: '+258 84 444 4444',
                email: 'vendas@medimoc.co.mz',
                address: 'Zona Industrial, Maputo',
                city: 'Maputo',
                province: 'Maputo',
                contactPerson: 'Dr. António Costa',
                paymentTerms: '30 dias',
                companyId: farmacia.id
            }
        });

        const fornecedorSuper = await prisma.supplier.upsert({
            where: { code: 'FOR-SUPER-001' },
            update: {},
            create: {
                code: 'FOR-SUPER-001',
                name: 'Distribuidora Moçambique',
                tradeName: 'Distribuidora Moz Lda',
                nuit: '500000001',
                phone: '+258 84 555 5555',
                email: 'comercial@distrimoz.co.mz',
                address: 'Av. do Trabalho, 456',
                city: 'Maputo',
                province: 'Maputo',
                contactPerson: 'Sr. Pedro Langa',
                paymentTerms: '45 dias',
                companyId: supermercado.id
            }
        });

        console.log('✅ 2 fornecedores criados\n');

        // ==========================================================================
        // 8. CRIAR PRODUTOS - FARMÁCIA
        // ==========================================================================
        console.log('💊 Criando produtos da farmácia...');

        const produtosFarmacia = [
            { code: 'MED-001', name: 'Paracetamol 500mg', category: 'medicine', price: 50, costPrice: 35, currentStock: 500, minStock: 100 },
            { code: 'MED-002', name: 'Ibuprofeno 400mg', category: 'medicine', price: 75, costPrice: 50, currentStock: 300, minStock: 80 },
            { code: 'MED-003', name: 'Amoxicilina 500mg', category: 'medicine', price: 120, costPrice: 85, currentStock: 200, minStock: 50 },
            { code: 'VIT-001', name: 'Vitamina C 1000mg', category: 'medicine', price: 180, costPrice: 120, currentStock: 150, minStock: 40 },
            { code: 'VIT-002', name: 'Complexo B', category: 'medicine', price: 200, costPrice: 140, currentStock: 100, minStock: 30 },
            { code: 'COS-001', name: 'Protetor Solar FPS 50', category: 'cosmetics', price: 350, costPrice: 250, currentStock: 80, minStock: 20 },
            { code: 'COS-002', name: 'Creme Hidratante', category: 'cosmetics', price: 280, costPrice: 200, currentStock: 120, minStock: 30 },
        ];

        for (const prod of produtosFarmacia) {
            const product = await prisma.product.upsert({
                where: { code: prod.code },
                update: {},
                create: {
                    ...prod,
                    status: prod.currentStock > prod.minStock ? 'in_stock' : 'low_stock',
                    unit: 'un',
                    supplierId: fornecedorFarmacia.id,
                    companyId: farmacia.id,
                    category: prod.category as any
                }
            });

            // Adicionar stock ao armazém
            await prisma.warehouseStock.upsert({
                where: {
                    warehouseId_productId: {
                        warehouseId: warehouseFarmacia.id,
                        productId: product.id
                    }
                },
                update: {},
                create: {
                    warehouseId: warehouseFarmacia.id,
                    productId: product.id,
                    quantity: prod.currentStock
                }
            });
        }

        console.log(`✅ ${produtosFarmacia.length} produtos da farmácia criados\n`);

        // ==========================================================================
        // 9. CRIAR PRODUTOS - SUPERMERCADO
        // ==========================================================================
        console.log('🛒 Criando produtos do supermercado...');

        const produtosSuper = [
            { code: 'ALIM-001', name: 'Arroz Tio Pat 25kg', category: 'food', price: 1500, costPrice: 1200, currentStock: 100, minStock: 20 },
            { code: 'ALIM-002', name: 'Óleo Girassol 900ml', category: 'food', price: 450, costPrice: 380, currentStock: 200, minStock: 40 },
            { code: 'ALIM-003', name: 'Açúcar Maragra 1kg', category: 'food', price: 85, costPrice: 70, currentStock: 300, minStock: 60 },
            { code: 'ALIM-004', name: 'Farinha Trigo 1kg', category: 'food', price: 95, costPrice: 75, currentStock: 250, minStock: 50 },
            { code: 'BEB-001', name: 'Coca-Cola 2L', category: 'beverages', price: 120, costPrice: 95, currentStock: 150, minStock: 40 },
            { code: 'BEB-002', name: 'Água Vumba 1.5L', category: 'beverages', price: 45, costPrice: 30, currentStock: 300, minStock: 80 },
            { code: 'BEB-003', name: 'Cerveja 2M 330ml', category: 'beverages', price: 80, costPrice: 60, currentStock: 200, minStock: 50 },
            { code: 'LIMP-001', name: 'Detergente OMO 1kg', category: 'cleaning', price: 280, costPrice: 220, currentStock: 100, minStock: 25 },
            { code: 'LIMP-002', name: 'Sabão em Pó 500g', category: 'cleaning', price: 150, costPrice: 110, currentStock: 120, minStock: 30 },
        ];

        for (const prod of produtosSuper) {
            const product = await prisma.product.upsert({
                where: { code: prod.code },
                update: {},
                create: {
                    ...prod,
                    status: prod.currentStock > prod.minStock ? 'in_stock' : 'low_stock',
                    unit: 'un',
                    supplierId: fornecedorSuper.id,
                    companyId: supermercado.id,
                    category: prod.category as any
                }
            });

            // Adicionar stock ao armazém
            await prisma.warehouseStock.upsert({
                where: {
                    warehouseId_productId: {
                        warehouseId: warehouseSuper.id,
                        productId: product.id
                    }
                },
                update: {},
                create: {
                    warehouseId: warehouseSuper.id,
                    productId: product.id,
                    quantity: prod.currentStock
                }
            });
        }

        console.log(`✅ ${produtosSuper.length} produtos do supermercado criados\n`);

        // ==========================================================================
        // 10. CRIAR CLIENTES
        // ==========================================================================
        console.log('👥 Criando clientes...');

        const clientesFarmacia = [
            { code: 'CLI-FARM-001', name: 'Ana Moreira', type: 'individual', phone: '+258 84 666 6666', email: 'ana@email.co.mz', companyId: farmacia.id },
            { code: 'CLI-FARM-002', name: 'José Tembe', type: 'individual', phone: '+258 84 777 7777', email: 'jose@email.co.mz', companyId: farmacia.id },
            { code: 'CLI-FARM-003', name: 'Hospital Central', type: 'company', phone: '+258 84 888 8888', email: 'compras@hospital.co.mz', companyId: farmacia.id },
        ];

        const clientesSuper = [
            { code: 'CLI-SUPER-001', name: 'Manuel Cossa', type: 'individual', phone: '+258 84 999 9999', email: 'manuel@email.co.mz', companyId: supermercado.id },
            { code: 'CLI-SUPER-002', name: 'Beatriz Nhantumbo', type: 'individual', phone: '+258 84 000 0001', email: 'beatriz@email.co.mz', companyId: supermercado.id },
            { code: 'CLI-SUPER-003', name: 'Restaurante Zambi', type: 'company', phone: '+258 84 000 0002', email: 'zambi@email.co.mz', companyId: supermercado.id },
        ];

        const createdCustomers: any = {};
        for (const cliente of [...clientesFarmacia, ...clientesSuper]) {
            const c = await prisma.customer.upsert({
                where: { code: cliente.code },
                update: {},
                create: {
                    ...cliente,
                    type: cliente.type as any,
                    address: 'Maputo',
                    city: 'Maputo',
                    province: 'Maputo'
                }
            });
            createdCustomers[cliente.code] = c;
        }

        console.log('✅ 6 clientes criados\n');

        // ==========================================================================
        // 11. CRIAR QUARTOS (HOTEL)
        // ==========================================================================
        console.log('🏨 Criando quartos do hotel...');

        const rooms = [
            { number: '101', type: 'single', price: 2500, companyId: hotel.id },
            { number: '102', type: 'single', price: 2500, companyId: hotel.id },
            { number: '201', type: 'double', price: 3500, companyId: hotel.id },
            { number: '202', type: 'double', price: 3500, companyId: hotel.id },
            { number: '301', type: 'suite', price: 5500, companyId: hotel.id },
            { number: '302', type: 'deluxe', price: 7500, companyId: hotel.id },
        ];

        const createdRooms: any = {};
        for (const room of rooms) {
            const r = await prisma.room.upsert({
                where: { number: room.number },
                update: {},
                create: {
                    ...room,
                    type: room.type as any,
                    status: 'available',
                    priceBreakfast: room.price + 500,
                    priceHalfBoard: room.price + 1000,
                    priceFullBoard: room.price + 1500,
                    priceNoMeal: room.price
                }
            });
            createdRooms[room.number] = r;
        }

        console.log('✅ 6 quartos criados\n');

        // ==========================================================================
        // 12. CRIAR VENDAS - FARMÁCIA
        // ==========================================================================
        console.log('💰 Criando vendas da farmácia...');

        const productsFarmacia = await prisma.product.findMany({
            where: { companyId: farmacia.id },
            take: 3
        });

        if (productsFarmacia.length > 0) {
            for (let i = 0; i < 5; i++) {
                const receiptNumber = `FARM-${String(i + 1).padStart(6, '0')}`;
                const items = productsFarmacia.slice(0, 2 + (i % 2));

                let subtotal = 0;
                const saleItems = items.map(p => {
                    const qty = 1 + (i % 3);
                    const total = Number(p.price) * qty;
                    subtotal += total;
                    return {
                        productId: p.id,
                        quantity: qty,
                        unitPrice: p.price,
                        discount: 0,
                        total
                    };
                });

                await prisma.sale.create({
                    data: {
                        receiptNumber,
                        customerId: createdCustomers['CLI-FARM-001'].id,
                        userId: userFarmacia.id,
                        companyId: farmacia.id,
                        subtotal,
                        discount: 0,
                        tax: subtotal * 0.16,
                        total: subtotal * 1.16,
                        paymentMethod: i % 2 === 0 ? 'cash' : 'mpesa',
                        amountPaid: subtotal * 1.16,
                        change: 0,
                        items: {
                            create: saleItems
                        }
                    }
                });
            }
        }

        console.log('✅ 5 vendas da farmácia criadas\n');

        // ==========================================================================
        // 13. CRIAR VENDAS - SUPERMERCADO
        // ==========================================================================
        console.log('💰 Criando vendas do supermercado...');

        const productsSuper = await prisma.product.findMany({
            where: { companyId: supermercado.id },
            take: 4
        });

        if (productsSuper.length > 0) {
            for (let i = 0; i < 8; i++) {
                const receiptNumber = `SUPER-${String(i + 1).padStart(6, '0')}`;
                const items = productsSuper.slice(0, 2 + (i % 3));

                let subtotal = 0;
                const saleItems = items.map(p => {
                    const qty = 2 + (i % 4);
                    const total = Number(p.price) * qty;
                    subtotal += total;
                    return {
                        productId: p.id,
                        quantity: qty,
                        unitPrice: p.price,
                        discount: 0,
                        total
                    };
                });

                await prisma.sale.create({
                    data: {
                        receiptNumber,
                        customerId: createdCustomers['CLI-SUPER-001'].id,
                        userId: userSuper.id,
                        companyId: supermercado.id,
                        subtotal,
                        discount: 0,
                        tax: subtotal * 0.16,
                        total: subtotal * 1.16,
                        paymentMethod: ['cash', 'card', 'mpesa'][i % 3] as any,
                        amountPaid: subtotal * 1.16,
                        change: 0,
                        items: {
                            create: saleItems
                        }
                    }
                });
            }
        }

        console.log('✅ 8 vendas do supermercado criadas\n');

        // ==========================================================================
        // 14. CRIAR RESERVAS - HOTEL
        // ==========================================================================
        console.log('🏨 Criando reservas do hotel...');

        const roomsList = await prisma.room.findMany({
            where: { companyId: hotel.id },
            take: 3
        });

        if (roomsList.length > 0) {
            for (let i = 0; i < 4; i++) {
                const room = roomsList[i % roomsList.length];
                const checkIn = new Date();
                checkIn.setDate(checkIn.getDate() - (5 - i));

                const checkOut = new Date(checkIn);
                checkOut.setDate(checkOut.getDate() + (2 + i));

                await prisma.booking.create({
                    data: {
                        roomId: room.id,
                        companyId: hotel.id,
                        customerName: `Hóspede ${i + 1}`,
                        guestCount: 1 + (i % 3),
                        checkIn,
                        checkOut: i < 2 ? checkOut : null,
                        expectedCheckout: checkOut,
                        totalPrice: Number(room.price) * (2 + i),
                        status: i < 2 ? 'checked_out' : 'checked_in',
                        mealPlan: ['none', 'breakfast', 'half_board', 'full_board'][i % 4] as any,
                        guestPhone: `+258 84 ${String(i).padStart(3, '0')} ${String(i).padStart(4, '0')}`,
                        guestDocumentType: 'BI',
                        guestDocumentNumber: `${String(100000000 + i)}`,
                        guestNationality: 'Moçambicana'
                    }
                });
            }
        }

        console.log('✅ 4 reservas do hotel criadas\n');

        // ==========================================================================
        // RESUMO FINAL
        // ==========================================================================
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ DADOS MULTIEMPRESA CARREGADOS COM SUCESSO!\n');
        console.log('📊 RESUMO:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   🏢 Empresas: 3');
        console.log('      - Farmácia Central');
        console.log('      - Supermercado Maputo');
        console.log('      - Hotel Polana');
        console.log('');
        console.log('   👤 Utilizadores: 3');
        console.log('      - admin@farmaciacentral.co.mz / senha123');
        console.log('      - admin@supermaputo.co.mz / senha123');
        console.log('      - admin@hotelpolana.co.mz / senha123');
        console.log('');
        console.log('   📦 Produtos: 16');
        console.log('   👥 Clientes: 6');
        console.log('   💰 Vendas: 13');
        console.log('   🏨 Quartos: 6');
        console.log('   📅 Reservas: 4');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('🎉 Pode agora fazer login com qualquer utilizador!\n');

    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

seedMultiCompanyData();
