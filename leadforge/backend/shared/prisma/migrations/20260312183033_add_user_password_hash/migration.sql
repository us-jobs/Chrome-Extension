/*
  Warnings:

  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- Add nullable column first
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT;

-- Backfill existing rows with a known dev hash (password: devpass123)
UPDATE "User"
SET "passwordHash" = '$2b$10$S.tiMtjrsA.EvZsAxQ7iWeXvfqZKnBGLzdQn.sYOo9PElcTKDPKp.'
WHERE "passwordHash" IS NULL;

-- Enforce NOT NULL
ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL;
