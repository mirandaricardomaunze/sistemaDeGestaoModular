import { FleetService } from './logistics/fleet.service';
import { OperationsService } from './logistics/operations.service';
import { AnalyticsService } from './logistics/analytics.service';
import { HRService } from './logistics/hr.service';

export class LogisticsService {
    private fleet = new FleetService();
    private operations = new OperationsService();
    private analytics = new AnalyticsService();
    private hr = new HRService();

    // ── Dashboard & Reports ──────────────────────────────────────────────────
    getDashboard(companyId: string) { return this.analytics.getDashboard(companyId); }
    getReportsSummary(companyId: string, query: any) { return this.analytics.getReportsSummary(companyId, query); }

    // ── Vehicles ──────────────────────────────────────────────────────────────
    getVehicles(companyId: string, query: any) { return this.fleet.getVehicles(companyId, query); }
    createVehicle(companyId: string, data: any) { return this.fleet.createVehicle(companyId, data); }
    updateVehicle(companyId: string, id: string, data: any) { return this.fleet.updateVehicle(companyId, id, data); }
    deleteVehicle(companyId: string, id: string) { return this.fleet.deleteVehicle(companyId, id); }

    // ── Drivers ───────────────────────────────────────────────────────────────
    getDrivers(companyId: string, query: any) { return this.fleet.getDrivers(companyId, query); }
    getDriver(companyId: string, id: string) { return this.fleet.getDriver(companyId, id); }
    createDriver(companyId: string, data: any) { return this.fleet.createDriver(companyId, data); }
    updateDriver(companyId: string, id: string, data: any) { return this.fleet.updateDriver(companyId, id, data); }
    deleteDriver(companyId: string, id: string) { return this.fleet.deleteDriver(companyId, id); }

    // ── Routes ────────────────────────────────────────────────────────────────
    getRoutes(companyId: string, query: any) { return this.operations.getRoutes(companyId, query); }
    getRoute(companyId: string, id: string) { return this.operations.getRoute(companyId, id); }
    createRoute(companyId: string, data: any) { return this.operations.createRoute(companyId, data); }
    updateRoute(companyId: string, id: string, data: any) { return this.operations.updateRoute(companyId, id, data); }
    deleteRoute(companyId: string, id: string) { return this.operations.deleteRoute(companyId, id); }

    // ── Deliveries ────────────────────────────────────────────────────────────
    getDeliveries(companyId: string, query: any) { return this.operations.getDeliveries(companyId, query); }
    getDelivery(companyId: string, id: string) { return this.operations.getDelivery(companyId, id); }
    createDelivery(companyId: string, data: any) { return this.operations.createDelivery(companyId, data); }
    updateDelivery(companyId: string, id: string, data: any) { return this.operations.updateDelivery(companyId, id, data); }
    deleteDelivery(companyId: string, id: string) { return this.operations.deleteDelivery(companyId, id); }
    updateDeliveryStatus(companyId: string, id: string, status: string, extra: any) { return this.operations.updateDeliveryStatus(companyId, id, status, extra); }
    payDelivery(companyId: string, id: string, data: any) { return this.operations.payDelivery(companyId, id, data); }

    // ── Parcels ───────────────────────────────────────────────────────────────
    getParcels(companyId: string, query: any) { return this.operations.getParcels(companyId, query); }
    getParcel(companyId: string, id: string) { return this.operations.getParcel(companyId, id); }
    trackParcel(companyId: string, trackingNumber: string) { return this.operations.trackParcel(companyId, trackingNumber); }
    createParcel(companyId: string, data: any) { return this.operations.createParcel(companyId, data); }
    updateParcel(companyId: string, id: string, data: any) { return this.operations.updateParcel(companyId, id, data); }
    deleteParcel(companyId: string, id: string) { return this.operations.deleteParcel(companyId, id); }
    registerParcelPickup(companyId: string, id: string, data: any) { return this.operations.registerParcelPickup(companyId, id, data); }
    updateParcelStatus(companyId: string, id: string, status: string) { return this.operations.updateParcelStatus(companyId, id, status); }
    sendParcelNotification(companyId: string, id: string, data: any) { return this.operations.sendParcelNotification(companyId, id, data); }

    // ── Maintenance ───────────────────────────────────────────────────────────
    getMaintenances(companyId: string, query: any) { return this.fleet.getMaintenances(companyId, query); }
    createMaintenance(companyId: string, data: any) { return this.fleet.createMaintenance(companyId, data); }
    updateMaintenance(companyId: string, id: string, data: any) { return this.fleet.updateMaintenance(companyId, id, data); }
    deleteMaintenance(companyId: string, id: string) { return this.fleet.deleteMaintenance(companyId, id); }

    // ── Fuel ──────────────────────────────────────────────────────────────────
    getFuelSupplies(companyId: string, params: any) { return this.fleet.getFuelSupplies(companyId, params); }
    createFuelSupply(companyId: string, data: any) { return this.fleet.createFuelSupply(companyId, data); }
    deleteFuelSupply(companyId: string, id: string) { return this.fleet.deleteFuelSupply(companyId, id); }

    // ── Incidents ─────────────────────────────────────────────────────────────
    getIncidents(companyId: string, params: any) { return this.fleet.getIncidents(companyId, params); }
    createIncident(companyId: string, data: any) { return this.fleet.createIncident(companyId, data); }
    updateIncident(companyId: string, id: string, data: any) { return this.fleet.updateIncident(companyId, id, data); }
    deleteIncident(companyId: string, id: string) { return this.fleet.deleteIncident(companyId, id); }

    // ── Staff HR ──────────────────────────────────────────────────────────────
    getStaffAttendance(companyId: string, query: any) { return this.hr.getStaffAttendance(companyId, query); }
    recordStaffTime(companyId: string, data: any) { return this.hr.recordStaffTime(companyId, data); }
    getStaffPayroll(companyId: string, query: any) { return this.hr.getStaffPayroll(companyId, query); }
    createStaffPayroll(companyId: string, data: any) { return this.hr.createStaffPayroll(companyId, data); }
    updateStaffPayrollStatus(companyId: string, id: string, status: string) { return this.hr.updateStaffPayrollStatus(companyId, id, status); }
}

export const logisticsService = new LogisticsService();
