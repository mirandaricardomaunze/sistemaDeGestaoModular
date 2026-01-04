import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // ==========================================================================
    // SEED BUSINESS MODULES
    // ==========================================================================
    const modules = [
        { code: 'PHARMACY', name: 'Farmácia', description: 'Gestão completa com CRM, RH, Estoque e Fiscal integrados para farmácias e drogarias.', icon: 'HiOutlineBeaker', color: '#10B981' },
        { code: 'COMMERCIAL', name: 'Comércio', description: 'Solução comercial robusta com CRM, RH, Estoque e Fiscal para retalho e atacado.', icon: 'HiOutlineShoppingCart', color: '#3B82F6' },
        { code: 'BOTTLE_STORE', name: 'Garrafeira', description: 'Gestão especializada de bebidas com CRM, RH, Estoque e Fiscal integrados.', icon: 'HiOutlineBuildingStorefront', color: '#8B5CF6' },
        { code: 'HOTEL', name: 'Hotelaria', description: 'Gestão hoteleira com CRM, RH, Estoque e Fiscal para total controlo administrativo.', icon: 'HiOutlineHomeModern', color: '#F59E0B' },
        { code: 'RESTAURANT', name: 'Restaurante', description: 'Gestão de mesas e pedidos com CRM, RH, Estoque e Fiscal integrados.', icon: 'HiOutlineCake', color: '#EF4444' },
        { code: 'LOGISTICS', name: 'Logística', description: 'Gestão de frotas e entregas com CRM, RH, Estoque e Fiscal especializados.', icon: 'HiOutlineTruck', color: '#6366F1' },
    ];

    for (const mod of modules) {
        await prisma.module.upsert({
            where: { code: mod.code },
            update: { name: mod.name, description: mod.description, icon: mod.icon, color: mod.color },
            create: mod
        });
    }
    console.log('✅ Business modules created:', modules.length);

    // ==========================================================================
    // SEED RBAC ROLES
    // ==========================================================================
    const roles = [
        { code: 'super_admin', name: 'Super Administrador', description: 'Acesso total ao sistema', isSystem: true },
        { code: 'company_admin', name: 'Administrador da Empresa', description: 'Acesso total à empresa', isSystem: true },
        { code: 'module_admin', name: 'Administrador de Módulo', description: 'Acesso total a um módulo específico', isSystem: true },
        { code: 'module_manager', name: 'Gerente de Módulo', description: 'Gestão operacional do módulo', isSystem: true },
        { code: 'module_operator', name: 'Operador', description: 'Operações do dia-a-dia', isSystem: true },
        { code: 'module_viewer', name: 'Visualizador', description: 'Apenas visualização', isSystem: true },
    ];

    for (const role of roles) {
        await prisma.role.upsert({
            where: { code: role.code },
            update: { name: role.name, description: role.description },
            create: role
        });
    }
    console.log('✅ RBAC roles created:', roles.length);

    // ==========================================================================
    // SEED PERMISSIONS (Cross-Cutting Layers + Module-Specific)
    // ==========================================================================
    const permissions = [
        // INVENTORY Layer
        { code: 'inventory.products.create', name: 'Criar Produtos', layer: 'INVENTORY' },
        { code: 'inventory.products.read', name: 'Ver Produtos', layer: 'INVENTORY' },
        { code: 'inventory.products.update', name: 'Editar Produtos', layer: 'INVENTORY' },
        { code: 'inventory.products.delete', name: 'Eliminar Produtos', layer: 'INVENTORY' },
        { code: 'inventory.stock.adjust', name: 'Ajustar Stock', layer: 'INVENTORY' },
        { code: 'inventory.transfers.manage', name: 'Gerir Transferências', layer: 'INVENTORY' },

        // CRM Layer
        { code: 'crm.customers.create', name: 'Criar Clientes', layer: 'CRM' },
        { code: 'crm.customers.read', name: 'Ver Clientes', layer: 'CRM' },
        { code: 'crm.customers.update', name: 'Editar Clientes', layer: 'CRM' },
        { code: 'crm.customers.delete', name: 'Eliminar Clientes', layer: 'CRM' },
        { code: 'crm.opportunities.manage', name: 'Gerir Oportunidades', layer: 'CRM' },

        // FISCAL Layer
        { code: 'fiscal.invoices.create', name: 'Criar Facturas', layer: 'FISCAL' },
        { code: 'fiscal.invoices.read', name: 'Ver Facturas', layer: 'FISCAL' },
        { code: 'fiscal.invoices.cancel', name: 'Anular Facturas', layer: 'FISCAL' },
        { code: 'fiscal.reports.generate', name: 'Gerar Relatórios Fiscais', layer: 'FISCAL' },
        { code: 'fiscal.settings.manage', name: 'Configurar Fiscal', layer: 'FISCAL' },

        // HR Layer
        { code: 'hr.employees.create', name: 'Criar Funcionários', layer: 'HR' },
        { code: 'hr.employees.read', name: 'Ver Funcionários', layer: 'HR' },
        { code: 'hr.employees.update', name: 'Editar Funcionários', layer: 'HR' },
        { code: 'hr.payroll.process', name: 'Processar Salários', layer: 'HR' },
        { code: 'hr.attendance.manage', name: 'Gerir Presenças', layer: 'HR' },
        { code: 'hr.vacations.approve', name: 'Aprovar Férias', layer: 'HR' },

        // PHARMACY Module
        { code: 'pharmacy.prescriptions.create', name: 'Criar Prescrições', module: 'PHARMACY' },
        { code: 'pharmacy.prescriptions.dispense', name: 'Dispensar Medicamentos', module: 'PHARMACY' },
        { code: 'pharmacy.controlled.manage', name: 'Gerir Controlados', module: 'PHARMACY' },

        // RESTAURANT Module
        { code: 'restaurant.tables.manage', name: 'Gerir Mesas', module: 'RESTAURANT' },
        { code: 'restaurant.orders.create', name: 'Criar Pedidos', module: 'RESTAURANT' },
        { code: 'restaurant.kitchen.view', name: 'Ver Cozinha', module: 'RESTAURANT' },

        // HOTEL Module
        { code: 'hotel.reservations.manage', name: 'Gerir Reservas', module: 'HOTEL' },
        { code: 'hotel.checkin.process', name: 'Fazer Check-in/out', module: 'HOTEL' },
        { code: 'hotel.rooms.manage', name: 'Gerir Quartos', module: 'HOTEL' },

        // BOTTLE_STORE Module
        { code: 'bottlestore.returns.manage', name: 'Gerir Retornáveis', module: 'BOTTLE_STORE' },
        { code: 'bottlestore.sales.create', name: 'Criar Vendas', module: 'BOTTLE_STORE' },

        // LOGISTICS Module
        { code: 'logistics.orders.manage', name: 'Gerir Encomendas', module: 'LOGISTICS' },
        { code: 'logistics.deliveries.track', name: 'Rastrear Entregas', module: 'LOGISTICS' },

        // COMMERCIAL Module
        { code: 'commercial.pos.use', name: 'Usar POS', module: 'COMMERCIAL' },
        { code: 'commercial.sales.create', name: 'Criar Vendas', module: 'COMMERCIAL' },
        { code: 'commercial.discounts.apply', name: 'Aplicar Descontos', module: 'COMMERCIAL' },
    ];

    for (const perm of permissions) {
        await prisma.permission.upsert({
            where: { code: perm.code },
            update: { name: perm.name, layer: perm.layer || null, module: perm.module || null },
            create: { ...perm, layer: perm.layer || null, module: perm.module || null }
        });
    }
    console.log('✅ Permissions created:', permissions.length);

    // ==========================================================================
    // LINK ROLES TO PERMISSIONS
    // ==========================================================================
    const allPermissions = await prisma.permission.findMany();
    const superAdminRole = await prisma.role.findUnique({ where: { code: 'super_admin' } });
    const companyAdminRole = await prisma.role.findUnique({ where: { code: 'company_admin' } });

    if (superAdminRole && companyAdminRole) {
        // Link all permissions to super_admin and company_admin
        for (const perm of allPermissions) {
            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: superAdminRole.id,
                        permissionId: perm.id
                    }
                },
                update: {},
                create: {
                    roleId: superAdminRole.id,
                    permissionId: perm.id
                }
            });

            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: companyAdminRole.id,
                        permissionId: perm.id
                    }
                },
                update: {},
                create: {
                    roleId: companyAdminRole.id,
                    permissionId: perm.id
                }
            });
        }
    }
    console.log('✅ Permissions linked to admin roles');

    // Create default admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    const superHashedPassword = await bcrypt.hash('superadmin123', 12);

    const superAdmin = await prisma.user.upsert({
        where: { email: 'superadmin@sistema.co.mz' },
        update: {},
        create: {
            email: 'superadmin@sistema.co.mz',
            password: superHashedPassword,
            name: 'Super Administrador',
            role: 'super_admin',
            phone: '+258 84 000 0001'
        }
    });
    console.log('✅ Super Admin user created:', superAdmin.email);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@sistema.co.mz' },
        update: {},
        create: {
            email: 'admin@sistema.co.mz',
            password: hashedPassword,
            name: 'Administrador',
            role: 'admin',
            phone: '+258 84 000 0000'
        }
    });

    // Assign company_admin role to the default admin
    if (companyAdminRole) {
        const existingRole = await prisma.userModuleRole.findFirst({
            where: {
                userId: admin.id,
                moduleId: null,
                roleId: companyAdminRole.id
            }
        });

        if (!existingRole) {
            await prisma.userModuleRole.create({
                data: {
                    userId: admin.id,
                    moduleId: null,
                    roleId: companyAdminRole.id
                }
            });
        }
    }
    console.log('✅ Admin user created and role assigned:', admin.email);

    // Create operator user
    const operator = await prisma.user.upsert({
        where: { email: 'operador@sistema.co.mz' },
        update: {},
        create: {
            email: 'operador@sistema.co.mz',
            password: await bcrypt.hash('operador123', 12),
            name: 'Operador Demo',
            role: 'operator',
            phone: '+258 84 111 1111'
        }
    });
    console.log('✅ Operator user created:', operator.email);

    // Create default warehouse
    const warehouse = await prisma.warehouse.upsert({
        where: { code: 'WH-PRINCIPAL' },
        update: {},
        create: {
            code: 'WH-PRINCIPAL',
            name: 'Armazém Principal',
            location: 'Maputo, Moçambique',
            responsible: 'Administrador',
            isDefault: true
        }
    });
    console.log('✅ Default warehouse created:', warehouse.name);

    // Create company settings
    await prisma.companySettings.upsert({
        where: { id: 'default-settings' },
        update: {},
        create: {
            id: 'default-settings',
            companyName: 'Minha Empresa',
            tradeName: 'Minha Empresa Lda',
            nuit: '000000000',
            phone: '+258 84 000 0000',
            email: 'geral@minhaempresa.co.mz',
            address: 'Av. Principal, 123',
            city: 'Maputo',
            province: 'Maputo',
            country: 'Moçambique',
            ivaRate: 16,
            currency: 'MZN'
        }
    });
    console.log('✅ Company settings created');

    // Create sample categories
    const categories = [
        { code: 'CAT-ALIM', name: 'Alimentação', color: '#22C55E' },
        { code: 'CAT-BEB', name: 'Bebidas', color: '#3B82F6' },
        { code: 'CAT-LIMP', name: 'Limpeza', color: '#F59E0B' },
        { code: 'CAT-HIG', name: 'Higiene', color: '#EC4899' },
        { code: 'CAT-OUT', name: 'Outros', color: '#6B7280' }
    ];

    for (const cat of categories) {
        await prisma.category.upsert({
            where: { code: cat.code },
            update: {},
            create: cat
        });
    }
    console.log('✅ Categories created:', categories.length);

    // Create sample supplier
    const supplier = await prisma.supplier.upsert({
        where: { code: 'FOR-001' },
        update: {},
        create: {
            code: 'FOR-001',
            name: 'Fornecedor Demo',
            tradeName: 'Fornecedor Demo Lda',
            nuit: '123456789',
            phone: '+258 84 222 2222',
            email: 'vendas@fornecedor.co.mz',
            address: 'Rua do Comércio, 456',
            city: 'Maputo',
            province: 'Maputo',
            contactPerson: 'João Silva',
            paymentTerms: '30 dias'
        }
    });
    console.log('✅ Sample supplier created:', supplier.name);

    // Create sample products
    const products = [
        { code: 'PROD-001', name: 'Arroz Tio Pat 25kg', category: 'food', price: 1500, costPrice: 1200, currentStock: 50, minStock: 10, unit: 'un' },
        { code: 'PROD-002', name: 'Óleo Girassol 900ml', category: 'food', price: 450, costPrice: 380, currentStock: 100, minStock: 20, unit: 'un' },
        { code: 'PROD-003', name: 'Açúcar Maragra 1kg', category: 'food', price: 85, costPrice: 70, currentStock: 200, minStock: 30, unit: 'un' },
        { code: 'PROD-004', name: 'Coca-Cola 2L', category: 'beverages', price: 120, costPrice: 95, currentStock: 80, minStock: 20, unit: 'un' },
        { code: 'PROD-005', name: 'Água Vumba 1.5L', category: 'beverages', price: 45, costPrice: 30, currentStock: 150, minStock: 50, unit: 'un' },
        { code: 'PROD-006', name: 'Detergente OMO 1kg', category: 'cleaning', price: 280, costPrice: 220, currentStock: 40, minStock: 10, unit: 'un' },
        { code: 'PROD-007', name: 'Sabonete Palmolive', category: 'cosmetics', price: 45, costPrice: 35, currentStock: 120, minStock: 30, unit: 'un' },
        { code: 'PROD-008', name: 'Leite Parmalat 1L', category: 'food', price: 110, costPrice: 85, currentStock: 60, minStock: 15, unit: 'un' },
        { code: 'PROD-009', name: 'Café Sical 250g', category: 'food', price: 320, costPrice: 260, currentStock: 35, minStock: 10, unit: 'un' },
        { code: 'PROD-010', name: 'Massa Esparguete 500g', category: 'food', price: 65, costPrice: 50, currentStock: 90, minStock: 20, unit: 'un' }
    ];

    for (const prod of products) {
        let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
        if (prod.currentStock === 0) status = 'out_of_stock';
        else if (prod.currentStock <= prod.minStock) status = 'low_stock';

        const product = await prisma.product.upsert({
            where: { code: prod.code },
            update: {},
            create: {
                ...prod,
                status,
                supplierId: supplier.id,
                category: prod.category as any
            }
        });

        // Add to warehouse stock
        await prisma.warehouseStock.upsert({
            where: {
                warehouseId_productId: {
                    warehouseId: warehouse.id,
                    productId: product.id
                }
            },
            update: { quantity: prod.currentStock },
            create: {
                warehouseId: warehouse.id,
                productId: product.id,
                quantity: prod.currentStock
            }
        });
    }
    console.log('✅ Sample products created:', products.length);

    // Create sample customer
    const customer = await prisma.customer.upsert({
        where: { code: 'CLI-001' },
        update: {},
        create: {
            code: 'CLI-001',
            name: 'Cliente Demo',
            type: 'individual',
            phone: '+258 84 333 3333',
            email: 'cliente@email.co.mz',
            address: 'Bairro Central, Casa 10',
            city: 'Maputo',
            province: 'Maputo'
        }
    });
    console.log('✅ Sample customer created:', customer.name);

    // Create sample employee
    const employee = await prisma.employee.upsert({
        where: { code: 'EMP-001' },
        update: {},
        create: {
            code: 'EMP-001',
            name: 'Maria Santos',
            email: 'maria@sistema.co.mz',
            phone: '+258 84 444 4444',
            role: 'cashier',
            department: 'Vendas',
            hireDate: new Date('2023-01-15'),
            baseSalary: 25000,
            subsidyTransport: 2000,
            subsidyFood: 3000,
            vacationDaysTotal: 22,
            socialSecurityNumber: 'INSS123456',
            nuit: '987654321'
        }
    });
    console.log('✅ Sample employee created:', employee.name);

    // Create sample campaign
    const campaign = await prisma.campaign.upsert({
        where: { code: 'BEM10' },
        update: {},
        create: {
            code: 'BEM10',
            name: 'Boas-Vindas 10%',
            description: 'Desconto de 10% para novos clientes',
            status: 'active',
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
            discountType: 'percentage',
            discountValue: 10,
            minPurchaseAmount: 500,
            maxTotalUses: 100
        }
    });
    console.log('✅ Sample campaign created:', campaign.name);

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📋 Login credentials:');
    console.log('   Admin: admin@sistema.co.mz / admin123');
    console.log('   Operador: operador@sistema.co.mz / operador123');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
