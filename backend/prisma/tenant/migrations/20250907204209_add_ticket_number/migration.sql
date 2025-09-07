/*
  Warnings:

  - A unique constraint covering the columns `[ticketNumber]` on the table `tickets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ticketNumber` to the `tickets` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UsageEventType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('TICKET', 'COMMENT', 'USER', 'ATTACHMENT', 'API_CALL');

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "ticketNumber" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL,
    "eventType" "UsageEventType" NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "incrementValue" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT NOT NULL,
    "ticketId" TEXT,
    "commentId" TEXT,
    "syncedToControl" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticketNumber_key" ON "tickets"("ticketNumber");

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
