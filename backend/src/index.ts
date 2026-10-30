import { buildApp } from './app.js';
import { config } from './config.js';

async function startServer() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Gracefully stopping Fastify server...`);
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during server shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    const address = await app.listen({
      port: config.PORT,
      host: config.HOST
    });
    console.log(`\n===============================================================`);
    console.log(`🚀 Foodizo & Obunuzi Fastify Engine listening on: ${address}`);
    console.log(`📍 Environment: ${config.NODE_ENV}`);
    console.log(`⚡ WebSocket Event Bus: ws://${config.HOST}:${config.PORT}/ws/events`);
    console.log(`===============================================================\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

startServer();

