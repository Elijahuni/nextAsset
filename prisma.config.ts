import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    // directUrl bypasses pgBouncer for migrations; falls back to DATABASE_URL locally
    url: process.env.DATABASE_URL!,
    directUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
