-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "logo" TEXT,
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'starter',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'TRIAL',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "maxUsers" INTEGER NOT NULL DEFAULT 10,
    "maxPermitsPerMonth" INTEGER NOT NULL DEFAULT 200,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "billingEmail" TEXT,
    "billingCycle" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scadaDemoMode" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TECHNICIAN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "permitNumber" TEXT NOT NULL,
    "riskType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "safetyChecks" TEXT NOT NULL DEFAULT '{}',
    "checklistNotes" TEXT,
    "technicianName" TEXT NOT NULL,
    "supervisorName" TEXT NOT NULL,
    "workLocation" TEXT NOT NULL,
    "workDescription" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "approveJustification" TEXT,
    "technicianSignature" TEXT,
    "supervisorSignature" TEXT,
    "photos" TEXT,
    "photosCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdByRole" TEXT,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "rejectedById" TEXT,
    "rejectedByName" TEXT,
    "workLatitude" DOUBLE PRECISION,
    "workLongitude" DOUBLE PRECISION,
    "workRadius" INTEGER NOT NULL DEFAULT 100,
    "workLocationId" TEXT,
    "locationSource" TEXT NOT NULL DEFAULT 'manual',
    "isSpecialProtocol" BOOLEAN NOT NULL DEFAULT false,
    "overrideJustification" TEXT,
    "specialApprovedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 100,
    "verificationMethod" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "qrCodeSecret" TEXT,
    "qrCodeData" TEXT,
    "beaconUuid" TEXT,
    "beaconMajor" INTEGER,
    "beaconMinor" INTEGER,
    "beaconRssi" INTEGER NOT NULL DEFAULT -70,

    CONSTRAINT "WorkLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "signerType" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerId" TEXT,
    "signatureData" TEXT NOT NULL,
    "signatureHash" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracyMeters" DOUBLE PRECISION,
    "isWithinGeofence" BOOLEAN,
    "distanceToWorkMeters" DOUBLE PRECISION,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HseDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "criticality" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "holderName" TEXT,
    "description" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "aiExtractedData" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "tags" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskTypeConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'AlertTriangle',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskTypeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItemConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "riskTypeKey" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT,
    "name" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "triggerDaysBefore" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sensor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "thresholdCritical" DOUBLE PRECISION NOT NULL,
    "thresholdWarning" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isSimulated" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastReadingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sensor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorReading" (
    "id" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT 'sensor:ingest',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'paid',
    "planName" TEXT NOT NULL,
    "description" TEXT,
    "invoicePdfUrl" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAlert" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "isAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "relatedEntityId" TEXT,
    "relatedEntityType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBase" (
    "id" TEXT NOT NULL,
    "errorCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rootCause" TEXT NOT NULL,
    "appliedSolution" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "referenceUrl" TEXT,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyAlert" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'PANICO',
    "ubicacion" TEXT NOT NULL DEFAULT '{}',
    "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
    "prioridad" TEXT NOT NULL DEFAULT 'ALTA',
    "descripcion" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attendedById" TEXT,
    "attendedByName" TEXT,
    "attendedAt" TIMESTAMP(3),

    CONSTRAINT "EmergencyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "message" TEXT NOT NULL,
    "senderType" TEXT NOT NULL DEFAULT 'USER',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "province" TEXT,
    "city" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "unit" TEXT NOT NULL DEFAULT 'unidad',
    "thumbnailUrl" TEXT,
    "thresholdMin" INTEGER NOT NULL DEFAULT 5,
    "thresholdMax" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryDevice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CAMERA',
    "ipAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "lastSeenAt" TIMESTAMP(3),
    "metadata" TEXT,
    "beaconUuid" TEXT,
    "beaconMajor" INTEGER,
    "beaconMinor" INTEGER,
    "beaconRssi" INTEGER NOT NULL DEFAULT -70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartInventory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "beaconId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "cameraCount" INTEGER,
    "beaconCount" INTEGER,
    "lastCountedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "discrepancy" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAudit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "deviceId" TEXT,
    "itemName" TEXT,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "beaconCount" INTEGER,
    "confidence" DOUBLE PRECISION,
    "snapshotUrl" TEXT,
    "rawImageUrl" TEXT,
    "discrepancy" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "notes" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HseReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "categoria" TEXT NOT NULL DEFAULT 'CONDICION_INSEGURA',
    "prioridad" TEXT NOT NULL DEFAULT 'MEDIA',
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "ubicacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HseReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportVehicle" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "capacityKg" DOUBLE PRECISION,
    "vin" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'DISPONIBLE',
    "lastInspectionAt" TIMESTAMP(3),
    "currentDriverId" TEXT,
    "metadata" TEXT DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportDriver" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseType" TEXT NOT NULL,
    "licenseExpiry" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',
    "fatigueScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTrips" INTEGER NOT NULL DEFAULT 0,
    "certificationData" TEXT DEFAULT '{}',
    "medicalExpiry" TIMESTAMP(3),
    "emergencyContact" TEXT DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportDriver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportRoute" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "estimatedDurationMin" INTEGER NOT NULL,
    "waypoints" TEXT DEFAULT '[]',
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIO',
    "hasHSECheckpoints" BOOLEAN NOT NULL DEFAULT false,
    "checkpointConfig" TEXT DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportTrip" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANIFICADO',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "startOdometerKm" DOUBLE PRECISION,
    "endOdometerKm" DOUBLE PRECISION,
    "fuelConsumed" DOUBLE PRECISION,
    "riskValidationResult" TEXT DEFAULT '{}',
    "inspectionResult" TEXT DEFAULT '{}',
    "blockingReason" TEXT,
    "blockedById" TEXT,
    "blockedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportInspection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "checklistResult" TEXT DEFAULT '{}',
    "passed" BOOLEAN NOT NULL,
    "issues" TEXT DEFAULT '[]',
    "photos" TEXT DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransportInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportDriverEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "snapshotUrl" TEXT,
    "aiAnalysis" TEXT DEFAULT '{}',
    "gpsLocation" TEXT DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "actionTaken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransportDriverEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalIncident" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT DEFAULT '{}',
    "estimatedImpact" TEXT DEFAULT '{}',
    "photos" TEXT DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'REPORTADO',
    "containmentMeasures" TEXT DEFAULT '[]',
    "remediationPlan" TEXT,
    "remediationDate" TIMESTAMP(3),
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalAssessment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "description" TEXT,
    "location" TEXT DEFAULT '{}',
    "scope" TEXT DEFAULT '{}',
    "findings" TEXT DEFAULT '[]',
    "recommendations" TEXT DEFAULT '[]',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalMetric" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION,
    "thresholdWarning" DOUBLE PRECISION NOT NULL,
    "thresholdCritical" DOUBLE PRECISION NOT NULL,
    "measurementDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "sensorId" TEXT,
    "locationId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HSEEventLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" TEXT DEFAULT '{}',
    "actorId" TEXT,
    "actorName" TEXT,
    "relatedEntityId" TEXT,
    "relatedEntityType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HSEEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_taxId_key" ON "Company"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_email_key" ON "Company"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_stripeCustomerId_key" ON "Company"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_stripeSubscriptionId_key" ON "Company"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_companyId_key" ON "User"("email", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Permit_permitNumber_key" ON "Permit"("permitNumber");

-- CreateIndex
CREATE INDEX "Permit_companyId_idx" ON "Permit"("companyId");

-- CreateIndex
CREATE INDEX "Permit_status_idx" ON "Permit"("status");

-- CreateIndex
CREATE INDEX "Permit_createdById_idx" ON "Permit"("createdById");

-- CreateIndex
CREATE INDEX "Permit_isSpecialProtocol_idx" ON "Permit"("isSpecialProtocol");

-- CreateIndex
CREATE UNIQUE INDEX "WorkLocation_qrCodeSecret_key" ON "WorkLocation"("qrCodeSecret");

-- CreateIndex
CREATE UNIQUE INDEX "WorkLocation_beaconUuid_key" ON "WorkLocation"("beaconUuid");

-- CreateIndex
CREATE INDEX "WorkLocation_latitude_longitude_idx" ON "WorkLocation"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "Signature_signatureHash_key" ON "Signature"("signatureHash");

-- CreateIndex
CREATE INDEX "Signature_permitId_idx" ON "Signature"("permitId");

-- CreateIndex
CREATE INDEX "HseDocument_companyId_idx" ON "HseDocument"("companyId");

-- CreateIndex
CREATE INDEX "HseDocument_userId_idx" ON "HseDocument"("userId");

-- CreateIndex
CREATE INDEX "HseDocument_expiryDate_idx" ON "HseDocument"("expiryDate");

-- CreateIndex
CREATE INDEX "HseDocument_criticality_idx" ON "HseDocument"("criticality");

-- CreateIndex
CREATE INDEX "HseDocument_status_idx" ON "HseDocument"("status");

-- CreateIndex
CREATE INDEX "RiskTypeConfig_companyId_idx" ON "RiskTypeConfig"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskTypeConfig_companyId_key_key" ON "RiskTypeConfig"("companyId", "key");

-- CreateIndex
CREATE INDEX "ChecklistItemConfig_companyId_idx" ON "ChecklistItemConfig"("companyId");

-- CreateIndex
CREATE INDEX "ChecklistItemConfig_riskTypeKey_idx" ON "ChecklistItemConfig"("riskTypeKey");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItemConfig_companyId_riskTypeKey_itemKey_key" ON "ChecklistItemConfig"("companyId", "riskTypeKey", "itemKey");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Sensor_companyId_idx" ON "Sensor"("companyId");

-- CreateIndex
CREATE INDEX "Sensor_locationId_idx" ON "Sensor"("locationId");

-- CreateIndex
CREATE INDEX "Sensor_type_idx" ON "Sensor"("type");

-- CreateIndex
CREATE INDEX "Sensor_isActive_idx" ON "Sensor"("isActive");

-- CreateIndex
CREATE INDEX "SensorReading_sensorId_timestamp_idx" ON "SensorReading"("sensorId", "timestamp");

-- CreateIndex
CREATE INDEX "SensorReading_sensorId_idx" ON "SensorReading"("sensorId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_companyId_idx" ON "ApiKey"("companyId");

-- CreateIndex
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_isActive_idx" ON "ApiKey"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionInvoice_stripeInvoiceId_key" ON "SubscriptionInvoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_companyId_idx" ON "SubscriptionInvoice"("companyId");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_paidAt_idx" ON "SubscriptionInvoice"("paidAt");

-- CreateIndex
CREATE INDEX "SystemAlert_companyId_idx" ON "SystemAlert"("companyId");

-- CreateIndex
CREATE INDEX "SystemAlert_isAcknowledged_idx" ON "SystemAlert"("isAcknowledged");

-- CreateIndex
CREATE INDEX "SystemAlert_type_idx" ON "SystemAlert"("type");

-- CreateIndex
CREATE INDEX "SystemAlert_severity_idx" ON "SystemAlert"("severity");

-- CreateIndex
CREATE INDEX "SystemAlert_createdAt_idx" ON "SystemAlert"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBase_errorCode_key" ON "KnowledgeBase"("errorCode");

-- CreateIndex
CREATE INDEX "EmergencyAlert_companyId_idx" ON "EmergencyAlert"("companyId");

-- CreateIndex
CREATE INDEX "EmergencyAlert_estado_idx" ON "EmergencyAlert"("estado");

-- CreateIndex
CREATE INDEX "EmergencyAlert_prioridad_idx" ON "EmergencyAlert"("prioridad");

-- CreateIndex
CREATE INDEX "EmergencyAlert_createdAt_idx" ON "EmergencyAlert"("createdAt");

-- CreateIndex
CREATE INDEX "SupportMessage_companyId_idx" ON "SupportMessage"("companyId");

-- CreateIndex
CREATE INDEX "SupportMessage_createdAt_idx" ON "SupportMessage"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryLocation_companyId_idx" ON "InventoryLocation"("companyId");

-- CreateIndex
CREATE INDEX "InventoryLocation_isActive_idx" ON "InventoryLocation"("isActive");

-- CreateIndex
CREATE INDEX "InventoryLocation_province_idx" ON "InventoryLocation"("province");

-- CreateIndex
CREATE INDEX "InventoryItem_companyId_idx" ON "InventoryItem"("companyId");

-- CreateIndex
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");

-- CreateIndex
CREATE INDEX "InventoryItem_isActive_idx" ON "InventoryItem"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_companyId_sku_key" ON "InventoryItem"("companyId", "sku");

-- CreateIndex
CREATE INDEX "InventoryDevice_companyId_idx" ON "InventoryDevice"("companyId");

-- CreateIndex
CREATE INDEX "InventoryDevice_locationId_idx" ON "InventoryDevice"("locationId");

-- CreateIndex
CREATE INDEX "InventoryDevice_type_idx" ON "InventoryDevice"("type");

-- CreateIndex
CREATE INDEX "InventoryDevice_status_idx" ON "InventoryDevice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryDevice_companyId_beaconUuid_key" ON "InventoryDevice"("companyId", "beaconUuid");

-- CreateIndex
CREATE INDEX "SmartInventory_companyId_idx" ON "SmartInventory"("companyId");

-- CreateIndex
CREATE INDEX "SmartInventory_locationId_idx" ON "SmartInventory"("locationId");

-- CreateIndex
CREATE INDEX "SmartInventory_itemId_idx" ON "SmartInventory"("itemId");

-- CreateIndex
CREATE INDEX "SmartInventory_discrepancy_idx" ON "SmartInventory"("discrepancy");

-- CreateIndex
CREATE UNIQUE INDEX "SmartInventory_itemId_locationId_key" ON "SmartInventory"("itemId", "locationId");

-- CreateIndex
CREATE INDEX "InventoryAudit_companyId_idx" ON "InventoryAudit"("companyId");

-- CreateIndex
CREATE INDEX "InventoryAudit_locationId_idx" ON "InventoryAudit"("locationId");

-- CreateIndex
CREATE INDEX "InventoryAudit_deviceId_idx" ON "InventoryAudit"("deviceId");

-- CreateIndex
CREATE INDEX "InventoryAudit_createdAt_idx" ON "InventoryAudit"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryAudit_discrepancy_idx" ON "InventoryAudit"("discrepancy");

-- CreateIndex
CREATE INDEX "HseReport_companyId_idx" ON "HseReport"("companyId");

-- CreateIndex
CREATE INDEX "HseReport_estado_idx" ON "HseReport"("estado");

-- CreateIndex
CREATE INDEX "HseReport_categoria_idx" ON "HseReport"("categoria");

-- CreateIndex
CREATE INDEX "HseReport_createdAt_idx" ON "HseReport"("createdAt");

-- CreateIndex
CREATE INDEX "TransportVehicle_companyId_idx" ON "TransportVehicle"("companyId");

-- CreateIndex
CREATE INDEX "TransportVehicle_status_idx" ON "TransportVehicle"("status");

-- CreateIndex
CREATE INDEX "TransportVehicle_isActive_idx" ON "TransportVehicle"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TransportVehicle_companyId_plate_key" ON "TransportVehicle"("companyId", "plate");

-- CreateIndex
CREATE INDEX "TransportDriver_companyId_idx" ON "TransportDriver"("companyId");

-- CreateIndex
CREATE INDEX "TransportDriver_status_idx" ON "TransportDriver"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TransportDriver_companyId_userId_key" ON "TransportDriver"("companyId", "userId");

-- CreateIndex
CREATE INDEX "TransportRoute_companyId_idx" ON "TransportRoute"("companyId");

-- CreateIndex
CREATE INDEX "TransportRoute_isActive_idx" ON "TransportRoute"("isActive");

-- CreateIndex
CREATE INDEX "TransportRoute_riskLevel_idx" ON "TransportRoute"("riskLevel");

-- CreateIndex
CREATE INDEX "TransportTrip_companyId_idx" ON "TransportTrip"("companyId");

-- CreateIndex
CREATE INDEX "TransportTrip_vehicleId_idx" ON "TransportTrip"("vehicleId");

-- CreateIndex
CREATE INDEX "TransportTrip_driverId_idx" ON "TransportTrip"("driverId");

-- CreateIndex
CREATE INDEX "TransportTrip_routeId_idx" ON "TransportTrip"("routeId");

-- CreateIndex
CREATE INDEX "TransportTrip_status_idx" ON "TransportTrip"("status");

-- CreateIndex
CREATE INDEX "TransportTrip_startDate_idx" ON "TransportTrip"("startDate");

-- CreateIndex
CREATE INDEX "TransportInspection_companyId_idx" ON "TransportInspection"("companyId");

-- CreateIndex
CREATE INDEX "TransportInspection_tripId_idx" ON "TransportInspection"("tripId");

-- CreateIndex
CREATE INDEX "TransportInspection_vehicleId_idx" ON "TransportInspection"("vehicleId");

-- CreateIndex
CREATE INDEX "TransportInspection_inspectorId_idx" ON "TransportInspection"("inspectorId");

-- CreateIndex
CREATE INDEX "TransportInspection_createdAt_idx" ON "TransportInspection"("createdAt");

-- CreateIndex
CREATE INDEX "TransportDriverEvent_companyId_idx" ON "TransportDriverEvent"("companyId");

-- CreateIndex
CREATE INDEX "TransportDriverEvent_tripId_idx" ON "TransportDriverEvent"("tripId");

-- CreateIndex
CREATE INDEX "TransportDriverEvent_driverId_idx" ON "TransportDriverEvent"("driverId");

-- CreateIndex
CREATE INDEX "TransportDriverEvent_eventType_idx" ON "TransportDriverEvent"("eventType");

-- CreateIndex
CREATE INDEX "TransportDriverEvent_timestamp_idx" ON "TransportDriverEvent"("timestamp");

-- CreateIndex
CREATE INDEX "TransportDriverEvent_riskLevel_idx" ON "TransportDriverEvent"("riskLevel");

-- CreateIndex
CREATE INDEX "EnvironmentalIncident_companyId_idx" ON "EnvironmentalIncident"("companyId");

-- CreateIndex
CREATE INDEX "EnvironmentalIncident_type_idx" ON "EnvironmentalIncident"("type");

-- CreateIndex
CREATE INDEX "EnvironmentalIncident_severity_idx" ON "EnvironmentalIncident"("severity");

-- CreateIndex
CREATE INDEX "EnvironmentalIncident_status_idx" ON "EnvironmentalIncident"("status");

-- CreateIndex
CREATE INDEX "EnvironmentalIncident_sourceType_idx" ON "EnvironmentalIncident"("sourceType");

-- CreateIndex
CREATE INDEX "EnvironmentalIncident_createdAt_idx" ON "EnvironmentalIncident"("createdAt");

-- CreateIndex
CREATE INDEX "EnvironmentalAssessment_companyId_idx" ON "EnvironmentalAssessment"("companyId");

-- CreateIndex
CREATE INDEX "EnvironmentalAssessment_type_idx" ON "EnvironmentalAssessment"("type");

-- CreateIndex
CREATE INDEX "EnvironmentalAssessment_status_idx" ON "EnvironmentalAssessment"("status");

-- CreateIndex
CREATE INDEX "EnvironmentalAssessment_nextReviewDate_idx" ON "EnvironmentalAssessment"("nextReviewDate");

-- CreateIndex
CREATE INDEX "EnvironmentalMetric_companyId_idx" ON "EnvironmentalMetric"("companyId");

-- CreateIndex
CREATE INDEX "EnvironmentalMetric_type_idx" ON "EnvironmentalMetric"("type");

-- CreateIndex
CREATE INDEX "EnvironmentalMetric_measurementDate_idx" ON "EnvironmentalMetric"("measurementDate");

-- CreateIndex
CREATE INDEX "EnvironmentalMetric_source_idx" ON "EnvironmentalMetric"("source");

-- CreateIndex
CREATE UNIQUE INDEX "HSEEventLog_eventId_key" ON "HSEEventLog"("eventId");

-- CreateIndex
CREATE INDEX "HSEEventLog_companyId_idx" ON "HSEEventLog"("companyId");

-- CreateIndex
CREATE INDEX "HSEEventLog_sourceModule_idx" ON "HSEEventLog"("sourceModule");

-- CreateIndex
CREATE INDEX "HSEEventLog_eventType_idx" ON "HSEEventLog"("eventType");

-- CreateIndex
CREATE INDEX "HSEEventLog_severity_idx" ON "HSEEventLog"("severity");

-- CreateIndex
CREATE INDEX "HSEEventLog_relatedEntityId_idx" ON "HSEEventLog"("relatedEntityId");

-- CreateIndex
CREATE INDEX "HSEEventLog_createdAt_idx" ON "HSEEventLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_specialApprovedById_fkey" FOREIGN KEY ("specialApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_workLocationId_fkey" FOREIGN KEY ("workLocationId") REFERENCES "WorkLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLocation" ADD CONSTRAINT "WorkLocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseDocument" ADD CONSTRAINT "HseDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseDocument" ADD CONSTRAINT "HseDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseDocument" ADD CONSTRAINT "HseDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskTypeConfig" ADD CONSTRAINT "RiskTypeConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItemConfig" ADD CONSTRAINT "ChecklistItemConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItemConfig" ADD CONSTRAINT "ChecklistItemConfig_riskTypeKey_companyId_fkey" FOREIGN KEY ("riskTypeKey", "companyId") REFERENCES "RiskTypeConfig"("key", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertConfig" ADD CONSTRAINT "AlertConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertConfig" ADD CONSTRAINT "AlertConfig_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "HseDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WorkLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemAlert" ADD CONSTRAINT "SystemAlert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDevice" ADD CONSTRAINT "InventoryDevice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDevice" ADD CONSTRAINT "InventoryDevice_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartInventory" ADD CONSTRAINT "SmartInventory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartInventory" ADD CONSTRAINT "SmartInventory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartInventory" ADD CONSTRAINT "SmartInventory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAudit" ADD CONSTRAINT "InventoryAudit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAudit" ADD CONSTRAINT "InventoryAudit_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAudit" ADD CONSTRAINT "InventoryAudit_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "InventoryDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseReport" ADD CONSTRAINT "HseReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseReport" ADD CONSTRAINT "HseReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportVehicle" ADD CONSTRAINT "TransportVehicle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportVehicle" ADD CONSTRAINT "TransportVehicle_currentDriverId_fkey" FOREIGN KEY ("currentDriverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportDriver" ADD CONSTRAINT "TransportDriver_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportDriver" ADD CONSTRAINT "TransportDriver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportRoute" ADD CONSTRAINT "TransportRoute_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTrip" ADD CONSTRAINT "TransportTrip_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTrip" ADD CONSTRAINT "TransportTrip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTrip" ADD CONSTRAINT "TransportTrip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTrip" ADD CONSTRAINT "TransportTrip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportInspection" ADD CONSTRAINT "TransportInspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportInspection" ADD CONSTRAINT "TransportInspection_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TransportTrip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportInspection" ADD CONSTRAINT "TransportInspection_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportInspection" ADD CONSTRAINT "TransportInspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportDriverEvent" ADD CONSTRAINT "TransportDriverEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportDriverEvent" ADD CONSTRAINT "TransportDriverEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TransportTrip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportDriverEvent" ADD CONSTRAINT "TransportDriverEvent_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportDriverEvent" ADD CONSTRAINT "TransportDriverEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalIncident" ADD CONSTRAINT "EnvironmentalIncident_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalIncident" ADD CONSTRAINT "EnvironmentalIncident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalAssessment" ADD CONSTRAINT "EnvironmentalAssessment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalMetric" ADD CONSTRAINT "EnvironmentalMetric_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HSEEventLog" ADD CONSTRAINT "HSEEventLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
