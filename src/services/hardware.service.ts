import { logger } from '../utils/logger';
/**
 * Hardware Service for managing Serial and USB device connections.
 * Uses Web Serial and Web USB APIs.
 */

class HardwareService {
    async requestSerialPort(options?: any): Promise<any | null> {
        try {
            if (!('serial' in navigator)) {
                throw new Error('Web Serial API not supported in this browser');
            }
            const port = await (navigator as any).serial.requestPort(options);
            return port;
        } catch (error) {
            logger.error('Error requesting serial port:', error);
            return null;
        }
    }

    async requestUSBDevice(options: any): Promise<any | null> {
        try {
            if (!('usb' in navigator)) {
                throw new Error('Web USB API not supported in this browser');
            }
            const device = await (navigator as any).usb.requestDevice(options);
            return device;
        } catch (error) {
            logger.error('Error requesting USB device:', error);
            return null;
        }
    }

    static isSerialSupported(): boolean {
        return 'serial' in navigator;
    }

    static isUSBSupported(): boolean {
        return 'usb' in navigator;
    }
}

export const hardwareService = new HardwareService();
