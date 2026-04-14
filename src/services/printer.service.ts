import { logger } from '../utils/logger';
/**
 * Printer Service handling ESC/POS commands for thermal printers.
 */
export class PrinterService {
    private static ESC = '\x1B';
    // private static GS = '\x1D';

    /**
     * Sends the pulse command to open the cash drawer.
     * Command: ESC p m t1 t2
     * m = 0 (pin 2), t1 = 25, t2 = 250
     */
    static async openDrawer(): Promise<boolean> {
        try {
            if (!('usb' in navigator)) {
                throw new Error('Web USB not supported');
            }

            // Using Web USB to send command directly to printer
            const device = await (navigator as any).usb.requestDevice({
                filters: [] // Empty filters to let user pick any device if no specific vendor known
            });

            await device.open();
            await device.selectConfiguration(1);
            await device.claimInterface(0);

            // ESC p 0 25 250
            const command = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);
            await device.transferOut(1, command);

            await device.close();
            return true;
        } catch (error) {
            logger.error('Failed to open drawer via USB:', error);

            // Fallback: Try a hidden iframe print with the escape sequence
            // This works on some Windows drivers that handle raw sequences
            try {
                const dummyIframe = document.createElement('iframe');
                dummyIframe.style.display = 'none';
                document.body.appendChild(dummyIframe);

                const seq = this.ESC + 'p' + '\x00' + '\x19' + '\xFA';
                dummyIframe.contentDocument?.write(seq);
                dummyIframe.contentWindow?.print();

                setTimeout(() => document.body.removeChild(dummyIframe), 1000);
                return true;
            } catch (fallbackError) {
                logger.error('Fallback drawer trigger failed:', fallbackError);
                return false;
            }
        }
    }

    static async printReceipt(content: string): Promise<boolean> {
        logger.info('Printing thermal receipt:', content);
        // Implement full thermal receipt printing logic here
        return true;
    }
}
