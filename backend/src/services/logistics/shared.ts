import { randomBytes } from 'crypto';
import { prisma } from '../../lib/prisma';

export const formatCode = (prefix: string, count: number): string => {
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
};

export const generateDriverCode = async (companyId: string): Promise<string> => {
    const count = await prisma.driver.count({ where: { companyId } });
    return formatCode('DRV', count);
};

export const generateRouteCode = async (companyId: string): Promise<string> => {
    const count = await prisma.deliveryRoute.count({ where: { companyId } });
    return formatCode('RTE', count);
};

export const generateDeliveryNumber = async (companyId: string): Promise<string> => {
    const today = new Date();
    const prefix = `DEL-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await prisma.delivery.count({ where: { companyId, number: { startsWith: prefix } } });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
};

export const generateTrackingNumber = (): string => {
    return 'PKG' + randomBytes(5).toString('hex').toUpperCase().slice(0, 9);
};
