import api from './client';

export interface CalendarEvent {
    id: string;
    companyId: string;
    createdById: string;
    title: string;
    description?: string | null;
    startAt: string;
    endAt: string;
    allDay: boolean;
    module?: string | null;
    color?: string | null;
    recurrence?: string | null;
    recurrenceEnd?: string | null;
    notifyBefore?: number | null;
    isCompleted: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: { id: string; name: string; avatar?: string | null };
    attendees: CalendarAttendee[];
}

export interface CalendarAttendee {
    id: string;
    eventId: string;
    userId: string;
    status: 'pending' | 'accepted' | 'declined';
    user: { id: string; name: string; avatar?: string | null };
}

export interface CreateCalendarEventDto {
    title: string;
    description?: string;
    startAt: string;
    endAt: string;
    allDay?: boolean;
    module?: string;
    color?: string;
    recurrence?: string;
    recurrenceEnd?: string;
    notifyBefore?: number;
    attendeeIds?: string[];
}

export interface UpdateCalendarEventDto extends Partial<CreateCalendarEventDto> {
    isCompleted?: boolean;
}

export const calendarAPI = {
    getEvents: async (params?: { start?: string; end?: string; module?: string }) => {
        const response = await api.get('/calendar/events', { params });
        return response.data as CalendarEvent[];
    },

    getEvent: async (id: string) => {
        const response = await api.get(`/calendar/events/${id}`);
        return response.data as CalendarEvent;
    },

    createEvent: async (data: CreateCalendarEventDto) => {
        const response = await api.post('/calendar/events', data);
        return response.data as CalendarEvent;
    },

    updateEvent: async (id: string, data: UpdateCalendarEventDto) => {
        const response = await api.patch(`/calendar/events/${id}`, data);
        return response.data as CalendarEvent;
    },

    deleteEvent: async (id: string) => {
        const response = await api.delete(`/calendar/events/${id}`);
        return response.data as { success: boolean };
    },

    rsvp: async (id: string, status: 'accepted' | 'declined' | 'pending') => {
        const response = await api.patch(`/calendar/events/${id}/rsvp`, { status });
        return response.data as CalendarAttendee;
    },

    getUpcoming: async () => {
        const response = await api.get('/calendar/upcoming');
        return response.data as Pick<CalendarEvent, 'id' | 'title' | 'startAt' | 'module' | 'color'>[];
    },
};
