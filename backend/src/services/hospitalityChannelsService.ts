import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';

export class HospitalityChannelsService {
    /**
     * Gerar feed iCal para um Quarto específico.
     * Isto é usado para exportar as reservas do Multicore para OTAs como Booking ou Airbnb.
     */
    async generateICalForRoom(companyId: string, roomId: string): Promise<string> {
        // Encontrar o quarto e validar
        const room = await prisma.room.findFirst({
            where: { id: roomId, companyId }
        });

        if (!room) {
            throw ApiError.notFound('Quarto não encontrado ou não pertence a esta empresa');
        }

        // Encontrar todas as reservas ativas ou agendadas para o futuro
        const bookings = await prisma.booking.findMany({
            where: {
                roomId,
                status: { in: ['confirmed', 'checked_in'] }, // Reservas que bloqueiam calendário
            },
            orderBy: { checkIn: 'asc' }
        });

        // Construir o formato texto iCal
        let ical = `BEGIN:VCALENDAR\r\n`;
        ical += `VERSION:2.0\r\n`;
        ical += `PRODID:-//Multicore ERP//Hospitality Channel Manager//PT\r\n`;
        ical += `CALSCALE:GREGORIAN\r\n`;
        ical += `METHOD:PUBLISH\r\n`;
        ical += `X-WR-CALNAME:Multicore - ${room.number}\r\n`;

        for (const b of bookings) {
            const dtStart = this.formatDateForICal(new Date(b.checkIn));
            const expectedOut = b.checkOut ? new Date(b.checkOut as any) : new Date(b.expectedCheckout as any);
            const dtEnd = this.formatDateForICal(expectedOut);
            const now = this.formatDateForICal(new Date());

            ical += `BEGIN:VEVENT\r\n`;
            ical += `DTSTART;VALUE=DATE:${dtStart}\r\n`;
            ical += `DTEND;VALUE=DATE:${dtEnd}\r\n`;
            ical += `DTSTAMP:${now}T000000Z\r\n`;
            ical += `UID:MC-BOOKING-${b.id}@multicore.erp\r\n`;
            ical += `SUMMARY:Reservado (Multicore)\r\n`;
            ical += `DESCRIPTION:Reserva local de Hospedagem.\r\n`;
            ical += `STATUS:CONFIRMED\r\n`;
            ical += `END:VEVENT\r\n`;
        }

        ical += `END:VCALENDAR`;

        return ical;
    }

    private formatDateForICal(date: Date): string {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    /**
     * Endpoint simulado para Importar de um icalLink (AirBnb, Booking).
     * O sistema dever fazer GET nesse `.ics`, converter VEVENT para as datas e bloquear a Room.
     */
    async syncFromICal(companyId: string, roomId: string, icalUrl: string) {
        // Implementação MVP de Importação
        const room = await prisma.room.findFirst({
            where: { id: roomId, companyId }
        });

        if (!room) {
            throw ApiError.notFound('Quarto não encontrado');
        }

        // Numa solução real de produção seria:
        // const response = await axios.get(icalUrl);
        // Analisar text/calendar response...
        
        return { message: "Sincronização iCal simulada concluída. Funcionalidade pronta para hook de produção." };
    }
}

export const hospitalityChannelsService = new HospitalityChannelsService();
