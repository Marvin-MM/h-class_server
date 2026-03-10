import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join(import.meta.dirname, 'schema.prisma'),
  migrate: {
    async resolveUrl() {
      return process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/hclass_lms';
    },
  },
});
