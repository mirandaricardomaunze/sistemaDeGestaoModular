import swaggerJsdoc from 'swagger-jsdoc';

const swaggerOptions: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Multicore API',
            version: '1.0.0',
            description: 'API completa para gestão de vendas, estoque, finanças e operações comerciais',
            contact: {
                name: 'API Support',
                email: 'support@sistema.com',
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT',
            },
        },
        servers: [
            {
                url: 'http://localhost:3001/api',
                description: 'Development server',
            },
            {
                url: 'https://api.seudominio.com/api',
                description: 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token obtido através do login',
                },
            },
            responses: {
                UnauthorizedError: {
                    description: 'Token de autenticação inválido ou expirado',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    error: {
                                        type: 'string',
                                        example: 'Token inválido ou expirado',
                                    },
                                },
                            },
                        },
                    },
                },
                ForbiddenError: {
                    description: 'Acesso negado - permissão insuficiente',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    error: {
                                        type: 'string',
                                        example: 'Acesso negado. Permissão insuficiente.',
                                    },
                                },
                            },
                        },
                    },
                },
                NotFoundError: {
                    description: 'Recurso não encontrado',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    error: {
                                        type: 'string',
                                        example: 'Recurso não encontrado',
                                    },
                                },
                            },
                        },
                    },
                },
            },
            schemas: {
                PaginationMeta: {
                    type: 'object',
                    properties: {
                        page: {
                            type: 'integer',
                            description: 'Página atual',
                        },
                        limit: {
                            type: 'integer',
                            description: 'Itens por página',
                        },
                        total: {
                            type: 'integer',
                            description: 'Total de itens',
                        },
                        totalPages: {
                            type: 'integer',
                            description: 'Total de páginas',
                        },
                        hasMore: {
                            type: 'boolean',
                            description: 'Há mais páginas',
                        },
                    },
                },
                Product: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        code: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string', nullable: true },
                        category: { type: 'string' },
                        price: { type: 'number', format: 'decimal' },
                        costPrice: { type: 'number', format: 'decimal' },
                        currentStock: { type: 'integer' },
                        minStock: { type: 'integer' },
                        maxStock: { type: 'integer', nullable: true },
                        unit: { type: 'string' },
                        barcode: { type: 'string', nullable: true },
                        status: { type: 'string', enum: ['in_stock', 'low_stock', 'out_of_stock'] },
                        isActive: { type: 'boolean' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: [
            {
                name: 'Auth',
                description: 'Autenticação e gestão de utilizadores',
            },
            {
                name: 'Products',
                description: 'Gestão de produtos e inventário',
            },
            {
                name: 'Sales',
                description: 'Gestão de vendas e transações',
            },
            {
                name: 'Customers',
                description: 'Gestão de clientes e relacionamento',
            },
            {
                name: 'Suppliers',
                description: 'Gestão de fornecedores e compras',
            },
            {
                name: 'Dashboard',
                description: 'Métricas e estatísticas do negócio',
            },
        ],
    },
    apis: ['./src/routes/*.ts'], // Path to API routes
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
