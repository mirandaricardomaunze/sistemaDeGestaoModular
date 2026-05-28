DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StaffCategory') THEN
    CREATE TYPE "StaffCategory" AS ENUM ('driver', 'mechanic', 'warehouse', 'manager', 'admin', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VehicleType') THEN
    CREATE TYPE "VehicleType" AS ENUM ('truck', 'van', 'motorcycle', 'car', 'bicycle', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VehicleStatus') THEN
    CREATE TYPE "VehicleStatus" AS ENUM ('available', 'in_use', 'maintenance', 'inactive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DriverStatus') THEN
    CREATE TYPE "DriverStatus" AS ENUM ('available', 'on_delivery', 'off_duty', 'inactive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaintenanceType') THEN
    CREATE TYPE "MaintenanceType" AS ENUM ('preventive', 'corrective', 'inspection', 'emergency');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaintenanceStatus') THEN
    CREATE TYPE "MaintenanceStatus" AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncidentType') THEN
    CREATE TYPE "IncidentType" AS ENUM ('accident', 'fine', 'breakdown', 'theft', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncidentSeverity') THEN
    CREATE TYPE "IncidentSeverity" AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncidentStatus') THEN
    CREATE TYPE "IncidentStatus" AS ENUM ('open', 'resolved', 'closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryStatus') THEN
    CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'scheduled', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryPriority') THEN
    CREATE TYPE "DeliveryPriority" AS ENUM ('low', 'normal', 'high', 'urgent');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ParcelStatus') THEN
    CREATE TYPE "ParcelStatus" AS ENUM ('received', 'awaiting_pickup', 'picked_up', 'overdue', 'returned_to_sender', 'lost');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    CREATE TYPE "NotificationType" AS ENUM ('email', 'sms', 'whatsapp', 'push');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "vehicles" (
  "id" TEXT NOT NULL,
  "plate" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "year" INTEGER,
  "type" "VehicleType" NOT NULL DEFAULT 'truck',
  "capacity" DECIMAL(10,2),
  "capacityUnit" TEXT DEFAULT 'kg',
  "fuelType" TEXT,
  "status" "VehicleStatus" NOT NULL DEFAULT 'available',
  "lastMaintenance" TIMESTAMP(3),
  "nextMaintenance" TIMESTAMP(3),
  "mileage" INTEGER NOT NULL DEFAULT 0,
  "insuranceExpiry" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "companyId" TEXT,
  CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "vehicles_companyId_plate_key" ON "vehicles"("companyId", "plate");
CREATE INDEX IF NOT EXISTS "vehicles_companyId_idx" ON "vehicles"("companyId");

CREATE TABLE IF NOT EXISTS "drivers" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "category" "StaffCategory" NOT NULL DEFAULT 'driver',
  "licenseNumber" TEXT NOT NULL,
  "licenseType" TEXT,
  "licenseExpiry" TIMESTAMP(3),
  "medicalExamExpiry" TIMESTAMP(3),
  "safetyTrainingDate" TIMESTAMP(3),
  "status" "DriverStatus" NOT NULL DEFAULT 'available',
  "hireDate" TIMESTAMP(3),
  "address" TEXT,
  "emergencyContact" TEXT,
  "baseSalary" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "subsidyTransport" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "subsidyFood" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "commissionRate" DECIMAL(5,2),
  "bankName" TEXT,
  "bankAccountNumber" TEXT,
  "bankNib" TEXT,
  "socialSecurityNumber" TEXT,
  "nuit" TEXT,
  "birthDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "companyId" TEXT,
  CONSTRAINT "drivers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "drivers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "drivers_companyId_code_key" ON "drivers"("companyId", "code");
CREATE INDEX IF NOT EXISTS "drivers_companyId_idx" ON "drivers"("companyId");

CREATE TABLE IF NOT EXISTS "vehicle_maintenances" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "type" "MaintenanceType" NOT NULL DEFAULT 'preventive',
  "description" TEXT NOT NULL,
  "cost" DECIMAL(15,2) NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextDate" TIMESTAMP(3),
  "mileageAt" INTEGER,
  "status" "MaintenanceStatus" NOT NULL DEFAULT 'scheduled',
  "provider" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "companyId" TEXT,
  CONSTRAINT "vehicle_maintenances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicle_maintenances_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "vehicle_maintenances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "vehicle_maintenances_vehicleId_idx" ON "vehicle_maintenances"("vehicleId");
CREATE INDEX IF NOT EXISTS "vehicle_maintenances_companyId_idx" ON "vehicle_maintenances"("companyId");

CREATE TABLE IF NOT EXISTS "fuel_supplies" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "liters" DECIMAL(10,2) NOT NULL,
  "pricePerLiter" DECIMAL(10,2),
  "amount" DECIMAL(15,2) NOT NULL,
  "mileage" INTEGER NOT NULL DEFAULT 0,
  "provider" TEXT,
  "notes" TEXT,
  "companyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fuel_supplies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fuel_supplies_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fuel_supplies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "fuel_supplies_vehicleId_idx" ON "fuel_supplies"("vehicleId");
CREATE INDEX IF NOT EXISTS "fuel_supplies_companyId_idx" ON "fuel_supplies"("companyId");

CREATE TABLE IF NOT EXISTS "vehicle_incidents" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "driverId" TEXT,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "type" "IncidentType" NOT NULL DEFAULT 'other',
  "severity" "IncidentSeverity" NOT NULL DEFAULT 'low',
  "description" TEXT NOT NULL,
  "cost" DECIMAL(15,2),
  "location" TEXT,
  "status" "IncidentStatus" NOT NULL DEFAULT 'open',
  "notes" TEXT,
  "companyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vehicle_incidents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicle_incidents_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "vehicle_incidents_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "vehicle_incidents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "vehicle_incidents_vehicleId_idx" ON "vehicle_incidents"("vehicleId");
CREATE INDEX IF NOT EXISTS "vehicle_incidents_driverId_idx" ON "vehicle_incidents"("driverId");
CREATE INDEX IF NOT EXISTS "vehicle_incidents_companyId_idx" ON "vehicle_incidents"("companyId");

CREATE TABLE IF NOT EXISTS "delivery_routes" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "originLat" DECIMAL(10,8),
  "originLng" DECIMAL(11,8),
  "destinationLat" DECIMAL(10,8),
  "destinationLng" DECIMAL(11,8),
  "distance" DECIMAL(10,2),
  "estimatedTime" INTEGER,
  "tollCost" DECIMAL(10,2),
  "fuelEstimate" DECIMAL(10,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "companyId" TEXT,
  CONSTRAINT "delivery_routes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_routes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_routes_companyId_code_key" ON "delivery_routes"("companyId", "code");
CREATE INDEX IF NOT EXISTS "delivery_routes_companyId_idx" ON "delivery_routes"("companyId");

CREATE TABLE IF NOT EXISTS "deliveries" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "orderId" TEXT,
  "customerId" TEXT,
  "routeId" TEXT,
  "vehicleId" TEXT,
  "driverId" TEXT,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
  "priority" "DeliveryPriority" NOT NULL DEFAULT 'normal',
  "scheduledDate" TIMESTAMP(3),
  "departureDate" TIMESTAMP(3),
  "deliveredDate" TIMESTAMP(3),
  "recipientName" TEXT,
  "recipientPhone" TEXT,
  "recipientSign" TEXT,
  "deliveryAddress" TEXT NOT NULL,
  "latitude" DECIMAL(10,8),
  "longitude" DECIMAL(11,8),
  "notes" TEXT,
  "proofOfDelivery" TEXT,
  "failureReason" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "companyId" TEXT,
  "country" TEXT DEFAULT 'Mozambique',
  "province" TEXT,
  "city" TEXT,
  "shippingCost" DECIMAL(15,2),
  "isPaid" BOOLEAN NOT NULL DEFAULT false,
  "transactionId" TEXT,
  CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "deliveries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "deliveries_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "deliveries_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "delivery_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "deliveries_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "deliveries_companyId_number_key" ON "deliveries"("companyId", "number");
CREATE INDEX IF NOT EXISTS "deliveries_companyId_idx" ON "deliveries"("companyId");
CREATE INDEX IF NOT EXISTS "deliveries_status_idx" ON "deliveries"("status");

CREATE TABLE IF NOT EXISTS "delivery_items" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "productId" TEXT,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "weight" DECIMAL(10,2),
  "notes" TEXT,
  CONSTRAINT "delivery_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_items_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "delivery_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "delivery_items_deliveryId_idx" ON "delivery_items"("deliveryId");

CREATE TABLE IF NOT EXISTS "parcels" (
  "id" TEXT NOT NULL,
  "trackingNumber" TEXT NOT NULL,
  "senderName" TEXT NOT NULL,
  "senderPhone" TEXT NOT NULL,
  "senderEmail" TEXT,
  "senderAddress" TEXT,
  "recipientName" TEXT NOT NULL,
  "recipientPhone" TEXT NOT NULL,
  "recipientEmail" TEXT,
  "recipientAddress" TEXT,
  "recipientDocument" TEXT,
  "description" TEXT,
  "weight" DECIMAL(10,2),
  "dimensions" TEXT,
  "status" "ParcelStatus" NOT NULL DEFAULT 'received',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedPickup" TIMESTAMP(3),
  "pickedUpAt" TIMESTAMP(3),
  "pickedUpBy" TEXT,
  "pickedUpDocument" TEXT,
  "pickupSignature" TEXT,
  "storageLocation" TEXT,
  "warehouseId" TEXT,
  "fees" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "isPaid" BOOLEAN NOT NULL DEFAULT false,
  "paymentMethod" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "companyId" TEXT,
  "receiverRelationship" TEXT,
  "transactionId" TEXT,
  CONSTRAINT "parcels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "parcels_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "parcels_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "parcels_companyId_trackingNumber_key" ON "parcels"("companyId", "trackingNumber");
CREATE INDEX IF NOT EXISTS "parcels_companyId_idx" ON "parcels"("companyId");
CREATE INDEX IF NOT EXISTS "parcels_status_idx" ON "parcels"("status");
CREATE INDEX IF NOT EXISTS "parcels_recipientPhone_idx" ON "parcels"("recipientPhone");

CREATE TABLE IF NOT EXISTS "parcel_notifications" (
  "id" TEXT NOT NULL,
  "parcelId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL DEFAULT 'email',
  "recipient" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "errorMsg" TEXT,
  CONSTRAINT "parcel_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "parcel_notifications_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "parcels"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "parcel_notifications_parcelId_idx" ON "parcel_notifications"("parcelId");

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "drivers"
  ADD COLUMN IF NOT EXISTS "category" "StaffCategory" NOT NULL DEFAULT 'driver',
  ADD COLUMN IF NOT EXISTS "medicalExamExpiry" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "safetyTrainingDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "baseSalary" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "subsidyTransport" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "subsidyFood" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS "bankName" TEXT,
  ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "bankNib" TEXT,
  ADD COLUMN IF NOT EXISTS "socialSecurityNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "nuit" TEXT,
  ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
