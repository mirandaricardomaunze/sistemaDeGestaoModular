// ============================================================================
// Product Types
// ============================================================================

export type ProductCategory =
    | 'electronics'
    | 'food'
    | 'medicine'
    | 'clothing'
    | 'furniture'
    | 'cosmetics'
    | 'beverages'
    | 'cleaning'
    | 'office'
    | 'other';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface Product {
    id: string;
    code: string;
    name: string;
    description?: string;
    category: ProductCategory;
    price: number;
    costPrice: number;
    currentStock: number;
    minStock: number;
    maxStock?: number;
    unit: string;
    barcode?: string;
    expiryDate?: string;
    batchNumber?: string;
    supplierId?: string;
    supplier?: string | { id: string; name: string; code: string };
    location?: string;
    status: StockStatus;
    imageUrl?: string;
    isActive?: boolean;
    isService?: boolean;
    requiresPrescription?: boolean;
    dosageForm?: string;
    strength?: string;
    manufacturer?: string;
    origin_module?: string;
    taxRate?: number;
    createdAt: string;
    updatedAt: string;
    // Multi-warehouse stock mapping: WarehouseID -> Quantity
    stocks?: Record<string, number>;
    // Warehouse stocks from backend
    warehouseStocks?: Array<{
        id: string;
        warehouseId: string;
        quantity: number;
        warehouse: { id: string; name: string; code: string };
    }>;
}

export interface ProductFilters {
    search?: string;
    category?: ProductCategory | 'all';
    status?: StockStatus | 'all';
    minPrice?: number;
    maxPrice?: number;
}

export type MovementType =
    | 'purchase'
    | 'sale'
    | 'return_in'
    | 'return_out'
    | 'adjustment'
    | 'expired'
    | 'transfer'
    | 'loss';

export interface StockMovement {
    id: string;
    productId: string;
    warehouseId?: string;
    movementType: MovementType;
    quantity: number;
    balanceBefore: number;
    balanceAfter: number;
    reference?: string;
    referenceType?: string;
    reason?: string;
    performedBy: string;
    createdAt: string;
    warehouse?: {
        id: string;
        name: string;
        code: string;
    };
}

// ============================================================================
// Warehouse & Stock Transfer Types
// ============================================================================

export interface Warehouse {
    id: string;
    name: string;
    code: string;
    location: string;
    responsible: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface StockTransfer {
    id: string;
    number: string; // e.g., GT-2024-001
    sourceWarehouseId: string;
    targetWarehouseId: string;
    items: {
        productId: string;
        productName: string;
        productCode?: string;
        productBarcode?: string;
        productDescription?: string;
        unit?: string;
        quantity: number;
        product?: {
            id: string;
            name: string;
            code: string;
            barcode?: string;
            description?: string;
            unit: string;
        };
    }[];
    status: 'pending' | 'completed' | 'cancelled';
    responsible: string;
    reason: string;
    date: string;
    createdAt: string;
}

// ============================================================================
// Employee Types
// ============================================================================

export type EmployeeRole = 'super_admin' | 'admin' | 'manager' | 'operator' | 'cashier' | 'stock_keeper';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'leave' | 'holiday' | 'vacation';
export type EducationLevel = 'ensino_fundamental' | 'ensino_medio' | 'tecnico' | 'graduacao' | 'pos_graduacao' | 'mestrado' | 'doutorado';
export type ContractType = 'indefinite' | 'fixed_term';

export interface AcademicQualification {
    id: string;
    level: EducationLevel;
    courseName: string;
    institution: string;
    startYear: number;
    endYear?: number;
    isCompleted: boolean;
    certificateNumber?: string;
}

export interface Employee {
    id: string;
    code: string;
    name: string;
    email: string;
    phone: string;
    role: EmployeeRole;
    department: string;
    hireDate: string;
    salary: number;
    address?: string;
    documentNumber?: string;
    emergencyContact?: string;
    profileImage?: string;
    isActive: boolean;
    qualifications?: AcademicQualification[];
    createdAt: string;
    // HR Fields
    bankInfo?: {
        bankName: string;
        accountNumber: string;
        nib: string;
    };
    socialSecurityNumber?: string; // INSS
    nuit?: string; // NUIT Pessoal
    baseSalary: number; // Salário Base Mensal
    subsidyTransport?: number;
    subsidyFood?: number;
    birthDate?: string;
    maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
    dependents?: number;
    vacationDaysTotal?: number; // Total de dias de férias por ano (Ex: 22)
    vacationDaysUsed?: number; // Dias já gozados
    contractType?: ContractType;
    contractExpiry?: string;
}

export interface PayrollAuditEntry {
    action: 'created' | 'updated' | 'printed' | 'paid' | 'received';
    userId: string;
    userName: string;
    timestamp: string;
    details?: string;
}

export interface PayrollRecord {
    id: string;
    employeeId: string;
    month: number; // 1-12
    year: number;
    baseSalary: number;
    otHours: number; // Horas Extras
    otAmount: number;
    bonus: number;
    allowances: number; // Subsídios (Transporte, Alimentação)
    inssDeduction: number; // 3%
    irtDeduction: number; // Imposto
    advances: number; // Adiantamentos
    totalEarnings: number;
    totalDeductions: number;
    netSalary: number;
    status: 'draft' | 'processed' | 'paid';
    processedAt?: string;
    paidAt?: string;
    paidBy?: string; // User ID who marked as paid
    receivedBy?: string; // Employee signature/confirmation
    receivedAt?: string;
    notes?: string;
    logs?: PayrollAuditEntry[];
}

export interface AttendanceRecord {
    id: string;
    employeeId: string;
    date: string;
    checkIn?: string;
    checkOut?: string;
    status: AttendanceStatus;
    hoursWorked?: number;
    notes?: string;
    justification?: string;
}

export interface AttendanceSummary {
    employeeId: string;
    month: number;
    year: number;
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    leaveDays: number;
    totalHours: number;
}

export type VacationStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface VacationRequest {
    id: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    days: number;
    status: VacationStatus;
    approvedBy?: string;
    notes?: string;
    createdAt: string;
}

// ============================================================================
// POS / Sales Types
// ============================================================================

export type PaymentMethod = 'cash' | 'card' | 'pix' | 'transfer' | 'credit' | 'mpesa' | 'emola';

export interface CartItem {
    productId: string;
    product: Product;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
}

export interface Sale {
    id: string;
    items: CartItem[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paymentMethod: PaymentMethod;
    amountPaid: number;
    change: number;
    customerId?: string;
    employeeId: string;
    createdAt: string;
    receiptNumber: string;
    customer?: ReceiptCustomer;
    series?: string;
    fiscalNumber?: number;
    hashCode?: string;
    notes?: string;
}

export interface ReceiptCustomer {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    document?: string;
    address?: string;
    notes?: string;
}

// ============================================================================
// Receipt Types
// ============================================================================

export interface ReceiptData {
    receiptNumber: string;
    date: string;
    customer?: ReceiptCustomer;
    items: CartItem[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paymentMethod: PaymentMethod;
    amountPaid: number;
    change: number;
    employeeName?: string;
    companyInfo: CompanyInfo;
}

export interface CompanyInfo {
    name: string;
    address: string;
    phone: string;
    email: string;
    taxId: string;
    logo?: string;
}

// ============================================================================
// Alert Types
// ============================================================================

export type AlertPriority = 'critical' | 'high' | 'medium' | 'low';
export type AlertType =
    | 'low_stock'
    | 'expired_product'
    | 'payment_due'
    | 'order_delayed'
    | 'system'
    | 'employee'
    | 'sales';

export interface Alert {
    id: string;
    type: AlertType;
    priority: AlertPriority;
    title: string;
    message: string;
    isRead: boolean;
    isResolved: boolean;
    createdAt: string;
    resolvedAt?: string;
    relatedId?: string;
    relatedType?: string;
}

export interface AlertConfig {
    lowStockThreshold: number;
    expiryWarningDays: number;
    paymentDueDays: number;
    enableEmailAlerts: boolean;
    enablePushNotifications: boolean;
}

// ============================================================================
// Financial Types
// ============================================================================

export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'pending' | 'completed' | 'cancelled';

export interface Transaction {
    id: string;
    type: TransactionType;
    category: string;
    description: string;
    amount: number;
    date: string;
    dueDate?: string;
    status: TransactionStatus;
    paymentMethod?: PaymentMethod;
    reference?: string;
    notes?: string;
}

export interface CashFlowSummary {
    period: string;
    income: number;
    expenses: number;
    balance: number;
}

// ============================================================================
// Invoice Types
// ============================================================================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';

export interface InvoiceItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
}

export interface InvoicePayment {
    id: string;
    date: string;
    amount: number;
    method: PaymentMethod;
    reference?: string;
    notes?: string;
}

export interface Invoice {
    id: string;
    invoiceNumber: string;
    orderId?: string;
    orderNumber?: string;
    customerId?: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    customerAddress?: string;
    customerDocument?: string;
    items: InvoiceItem[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    amountPaid: number;
    amountDue: number;
    status: InvoiceStatus;
    issueDate: string;
    dueDate: string;
    paidDate?: string;
    payments: InvoicePayment[];
    notes?: string;
    terms?: string;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// Credit Note Types
// ============================================================================

export type CreditNoteStatus = 'draft' | 'issued' | 'refunded';

export interface CreditNoteItem {
    id: string;
    productId: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    originalInvoiceItemId: string;
}

export interface CreditNote {
    id: string;
    number: string; // e.g., NC-2024-001
    originalInvoiceId: string;
    originalInvoiceNumber: string;
    customerId: string;
    customerName: string;
    items: CreditNoteItem[];
    subtotal: number;
    tax: number;
    total: number;
    reason: string;
    status: CreditNoteStatus;
    issueDate: string;
    createdAt: string;
    notes?: string;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardMetrics {
    totalSales: number;
    salesGrowth: number;
    totalOrders: number;
    ordersGrowth: number;
    lowStockItems: number;
    activeEmployees: number;
    pendingAlerts: number;
    revenue: number;
}

export interface ChartData {
    name: string;
    value: number;
    [key: string]: string | number;
}

// ============================================================================
// UI Types
// ============================================================================

export type BusinessType =
    | 'retail'
    | 'pharmacy'
    | 'supermarket'
    | 'hotel'
    | 'logistics'
    | 'bottlestore';

export interface SidebarItem {
    id: string;
    label: string;
    icon: string;
    path: string;
    children?: SidebarItem[];
    roles?: EmployeeRole[];
}

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface TableColumn<T> {
    id: string;
    header: string;
    accessor: keyof T | ((row: T) => React.ReactNode);
    sortable?: boolean;
    width?: string;
}

export interface PaginationState {
    pageIndex: number;
    pageSize: number;
    total: number;
}

// ============================================================================
// Form Types
// ============================================================================

export interface FormFieldError {
    message: string;
}

export interface SelectOption {
    value: string;
    label: string;
}

// ============================================================================
// Customer Types
// ============================================================================

export type CustomerType = 'individual' | 'company';

export interface Customer {
    id: string;
    code: string;
    name: string;
    type: CustomerType;
    email?: string;
    phone: string;
    document?: string; // BI/NUIT
    address?: string;
    city?: string;
    province?: string;
    notes?: string;
    creditLimit?: number;
    currentBalance: number;
    totalPurchases: number;
    loyaltyPoints?: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// Hospitality Types
// ============================================================================

export type RoomStatus = 'available' | 'occupied' | 'dirty' | 'maintenance';
export type RoomType = 'single' | 'double' | 'suite' | 'deluxe';
export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
export type MealPlan = 'none' | 'breakfast' | 'half_board' | 'full_board';

export interface Room {
    id: string;
    number: string;
    type: RoomType;
    status: RoomStatus;
    price: number;
    priceNoMeal?: number;
    priceBreakfast?: number;
    priceHalfBoard?: number;
    priceFullBoard?: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    bookings?: Booking[];
}

export interface Booking {
    id: string;
    roomId: string;
    customerId: string;
    customerName: string;
    guestCount: number;
    guestDocumentType?: string;
    guestDocumentNumber?: string;
    guestNationality?: string;
    guestPhone?: string;
    checkIn: string;
    checkOut?: string;
    totalPrice: number;
    mealPlan?: MealPlan;
    status: BookingStatus;
    createdAt: string;
    updatedAt: string;
    room?: Room;
    consumptions?: BookingConsumption[];
}

export interface BookingConsumption {
    id: string;
    bookingId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
    createdAt: string;
    product?: Product;
}

// ============================================================================
// Supplier Types
// ============================================================================

export interface Supplier {
    id: string;
    code: string;
    name: string;
    tradeName?: string;
    nuit?: string; // Tax ID
    email?: string;
    phone: string;
    phone2?: string;
    address?: string;
    city?: string;
    province?: string;
    contactPerson?: string;
    paymentTerms?: string;
    notes?: string;
    categories?: string[]; // Product categories they supply
    currentBalance: number;
    totalPurchases: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// Purchase Order Types
// ============================================================================

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled';

export interface PurchaseOrderItem {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    receivedQty: number;
    unitCost: number;
    total: number;
}

export interface PurchaseOrder {
    id: string;
    orderNumber: string;
    supplierId: string;
    supplierName: string;
    items: PurchaseOrderItem[];
    total: number;
    status: PurchaseOrderStatus;
    expectedDeliveryDate?: string;
    createdAt: string;
    updatedAt: string;
    notes?: string;
}

// ============================================================================
// Category Types
// ============================================================================

export interface Category {
    id: string;
    code: string;
    name: string;
    description?: string;
    parentId?: string; // For subcategories
    color?: string;
    icon?: string;
    productCount: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// Authentication Types
// ============================================================================

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'operator' | 'cashier' | 'stock_keeper';

export interface Company {
    id: string;
    name: string;
    status?: 'active' | 'inactive' | 'suspended';
    settings?: any;
}

export interface User {
    id: string;
    name: string;
    email: string;
    password: string; // In production, this would be hashed
    role: UserRole;
    phone?: string;
    avatar?: string;
    isActive: boolean;
    createdAt: string;
    lastLogin?: string;
    permissions?: string[];
    activeModules?: string[];
    activeLayers?: string[];
    company?: Company | null;
}

export interface AuthState {
    user: User | null;
    users: User[];
    isAuthenticated: boolean;
    isLoading: boolean;
}
