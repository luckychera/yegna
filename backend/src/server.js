const app = require('./app');

const env = require('./config/env');
const { checkDatabaseConnection, closeDatabase } = require('./config/database');

let server;

async function startServer() {
  try {
    await checkDatabaseConnection();

    server = app.listen(env.port, () => {
      console.log(`Yegna API running on http://localhost:${env.port}`);
      console.log(`Environment: ${env.nodeEnv}`);
      console.log(`Database: PostgreSQL`);
    });
  } catch (error) {
    console.error('Failed to start Yegna API:', error);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  if (server) {
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
  } else {
    await closeDatabase();
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();
