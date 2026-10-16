/**
 * Normalize failed_emails timestamp columns to created_at / updated_at.
 * Must run BEFORE sequelize.sync({ alter: true }) so Sequelize does not try
 * ADD COLUMN created_at NOT NULL on a non-empty table.
 */
import sequelize from '../config/db.js';

export async function ensureFailedEmailTimestamps(db = sequelize) {
  const [tables] = await db.query(`
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'failed_emails'
    LIMIT 1
  `);
  if (!tables.length) {
    console.log('failed_emails table not found yet — sync will create it');
    return;
  }

  const [cols] = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'failed_emails'
  `);
  const names = new Set(cols.map((c) => c.column_name));

  // Rename legacy camelCase columns if snake_case missing
  if (names.has('createdAt') && !names.has('created_at')) {
    await db.query('ALTER TABLE failed_emails RENAME COLUMN "createdAt" TO created_at');
    console.log('Renamed createdAt → created_at');
    names.add('created_at');
    names.delete('createdAt');
  }
  if (names.has('updatedAt') && !names.has('updated_at')) {
    await db.query('ALTER TABLE failed_emails RENAME COLUMN "updatedAt" TO updated_at');
    console.log('Renamed updatedAt → updated_at');
    names.add('updated_at');
    names.delete('updatedAt');
  }

  // Add as NULLABLE first (never NOT NULL on non-empty tables)
  if (!names.has('created_at')) {
    await db.query('ALTER TABLE failed_emails ADD COLUMN created_at TIMESTAMPTZ NULL');
    console.log('Added nullable created_at');
    names.add('created_at');
  }
  if (!names.has('updated_at')) {
    await db.query('ALTER TABLE failed_emails ADD COLUMN updated_at TIMESTAMPTZ NULL');
    console.log('Added nullable updated_at');
    names.add('updated_at');
  }

  await db.query(`
    UPDATE failed_emails
    SET
      created_at = COALESCE(created_at, NOW()),
      updated_at = COALESCE(updated_at, created_at, NOW())
    WHERE created_at IS NULL OR updated_at IS NULL
  `);

  // Safe to tighten nullability after backfill
  await db.query('ALTER TABLE failed_emails ALTER COLUMN created_at SET DEFAULT NOW()');
  await db.query('ALTER TABLE failed_emails ALTER COLUMN updated_at SET DEFAULT NOW()');
  await db.query('ALTER TABLE failed_emails ALTER COLUMN created_at SET NOT NULL');
  await db.query('ALTER TABLE failed_emails ALTER COLUMN updated_at SET NOT NULL');

  // Drop leftover camelCase duplicates if both exist
  const [cols2] = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'failed_emails'
  `);
  const names2 = new Set(cols2.map((c) => c.column_name));
  if (names2.has('createdAt') && names2.has('created_at')) {
    await db.query('ALTER TABLE failed_emails DROP COLUMN "createdAt"');
    console.log('Dropped duplicate createdAt');
  }
  if (names2.has('updatedAt') && names2.has('updated_at')) {
    await db.query('ALTER TABLE failed_emails DROP COLUMN "updatedAt"');
    console.log('Dropped duplicate updatedAt');
  }
}

async function run() {
  const dotenv = await import('dotenv');
  dotenv.default.config({ quiet: true });
  await ensureFailedEmailTimestamps();
  const [rows] = await sequelize.query('SELECT COUNT(*)::int AS n FROM failed_emails');
  console.log('Query OK, rows:', rows[0]?.n ?? 0);
  await sequelize.close();
}

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(async (error) => {
    console.error(error.message);
    await sequelize.close();
    process.exit(1);
  });
}
