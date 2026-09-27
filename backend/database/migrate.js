const fs = require('fs');
const path = require('path');

const { query, closeDatabase } = require('../src/config/database');

const migrationsDirectory = path.join(__dirname, 'migrations');

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      version VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations() {
  const result = await query(`
    SELECT version
    FROM schema_migrations
    ORDER BY version;
  `);

  return new Set(result.rows.map((row) => row.version));
}

async function runMigrations() {
  await ensureMigrationsTable();

  const appliedMigrations = await getAppliedMigrations();

  const migrationFiles = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const version = file.split('_')[0];
    const name = file.replace(/\.sql$/, '');

    if (appliedMigrations.has(version)) {
      continue;
    }

    const filePath = path.join(migrationsDirectory, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`Applying migration: ${file}`);

    try {
      await query('BEGIN');

      await query(sql);

      await query(
        `
          INSERT INTO schema_migrations (version, name)
          VALUES ($1, $2);
        `,
        [version, name],
      );

      await query('COMMIT');

      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await query('ROLLBACK');

      console.error(`Migration failed: ${file}`);
      throw error;
    }
  }

  console.log('Database migrations completed.');
}

runMigrations()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
