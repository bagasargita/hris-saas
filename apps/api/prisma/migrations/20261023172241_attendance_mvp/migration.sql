-- CreateEnum
CREATE TYPE "AttendanceRecordStatus" AS ENUM ('OPEN', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttendanceApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "managerId" UUID;

-- CreateTable
CREATE TABLE "attendance_sites" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 150,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "siteId" UUID,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "workDate" DATE NOT NULL,
    "clockInAt" TIMESTAMP(3) NOT NULL,
    "clockOutAt" TIMESTAMP(3),
    "clockInLat" DOUBLE PRECISION NOT NULL,
    "clockInLng" DOUBLE PRECISION NOT NULL,
    "clockOutLat" DOUBLE PRECISION,
    "clockOutLng" DOUBLE PRECISION,
    "status" "AttendanceRecordStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "lateMinutes" INTEGER,
    "earlyLeaveMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_approvals" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "approverMembershipId" UUID NOT NULL,
    "decision" "AttendanceApprovalDecision" NOT NULL,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_sites_tenantId_idx" ON "attendance_sites"("tenantId");

-- CreateIndex
CREATE INDEX "work_schedules_tenantId_idx" ON "work_schedules"("tenantId");

-- CreateIndex
CREATE INDEX "work_schedules_siteId_idx" ON "work_schedules"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedules_membershipId_weekday_key" ON "work_schedules"("membershipId", "weekday");

-- CreateIndex
CREATE INDEX "attendance_records_tenantId_workDate_idx" ON "attendance_records"("tenantId", "workDate");

-- CreateIndex
CREATE INDEX "attendance_records_membershipId_status_idx" ON "attendance_records"("membershipId", "status");

-- CreateIndex
CREATE INDEX "attendance_records_tenantId_status_idx" ON "attendance_records"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_approvals_recordId_key" ON "attendance_approvals"("recordId");

-- CreateIndex
CREATE INDEX "attendance_approvals_tenantId_idx" ON "attendance_approvals"("tenantId");

-- CreateIndex
CREATE INDEX "memberships_managerId_idx" ON "memberships"("managerId");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_managerId_tenantId_fkey" FOREIGN KEY ("managerId", "tenantId") REFERENCES "memberships"("id", "tenantId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sites" ADD CONSTRAINT "attendance_sites_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_membershipId_tenantId_fkey" FOREIGN KEY ("membershipId", "tenantId") REFERENCES "memberships"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "attendance_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_membershipId_tenantId_fkey" FOREIGN KEY ("membershipId", "tenantId") REFERENCES "memberships"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "attendance_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_approvals" ADD CONSTRAINT "attendance_approvals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_approvals" ADD CONSTRAINT "attendance_approvals_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_approvals" ADD CONSTRAINT "attendance_approvals_approverMembershipId_tenantId_fkey" FOREIGN KEY ("approverMembershipId", "tenantId") REFERENCES "memberships"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
