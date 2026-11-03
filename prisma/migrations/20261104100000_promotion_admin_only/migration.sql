-- Promotion visible only to a signed-in admin (see schema.prisma)
ALTER TABLE "promotions" ADD COLUMN "adminOnly" BOOLEAN NOT NULL DEFAULT false;
