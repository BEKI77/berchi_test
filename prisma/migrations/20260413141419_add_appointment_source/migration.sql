-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('MANUAL', 'ONLINE');

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_staff_id_fkey";

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "source" "AppointmentSource" NOT NULL DEFAULT 'MANUAL',
ALTER COLUMN "staff_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
