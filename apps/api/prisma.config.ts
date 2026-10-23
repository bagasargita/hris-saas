import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Not required for `prisma generate`, so a missing value must not crash code generation in CI.
    url: process.env['DATABASE_URL'] ?? '',
  },
});
