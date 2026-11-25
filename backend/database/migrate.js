const fs = require('fs');
const path = require('path');

const { pool, closeDatabase } = require('../src/config/database');

const migrationsDirectory = path.join(__dirname, 'migrations');

// Some early migrations manage their own BEGIN/COMMIT. Running them inside the
// runner's transaction would commit early, so those statements are stripped and
// the runner's transaction wraps the whole file instead.
function stripTransactionControl(sql) {
  return sql.replace(/^\s*(BEGIN|COMMIT)\s*;\s*$/gim, '');
}

async function runMigrations() {
  // Every statement of a migration must run on the same connection, otherwise
  // BEGIN/COMMIT/ROLLBACK would apply to whichever pooled connection was free.
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGSERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appliedResult = await client.query('SELECT version FROM schema_migrations;');
    const appliedMigrations = new Set(appliedResult.rows.map((row) => row.version));

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

      const sql = stripTransactionControl(fs.readFileSync(path.join(migrationsDirectory, file), 'utf8'));

      console.log(`Applying migration: ${file}`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2);', [
          version,
          name,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`Migration failed: ${file}`);
        throw error;
      }

      console.log(`Applied migration: ${file}`);
    }

    console.log('Database migrations completed.');
  } finally {
    client.release();
  }
}

runMigrations()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
