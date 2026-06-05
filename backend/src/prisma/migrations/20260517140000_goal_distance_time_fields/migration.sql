-- AlterEnum
ALTER TYPE "GoalType" ADD VALUE 'TIME_TOTAL';

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "targetDistanceKm" DOUBLE PRECISION,
ADD COLUMN     "targetTimeMinutes" DOUBLE PRECISION;

-- Datos existentes: TOTAL_KM guardaba km en targetValue; RACE_TIME guardaba minutos.
UPDATE "Goal" SET "targetTimeMinutes" = "targetValue" WHERE "type" = 'RACE_TIME';
UPDATE "Goal" SET "targetDistanceKm" = "targetValue" WHERE "type" = 'TOTAL_KM';
