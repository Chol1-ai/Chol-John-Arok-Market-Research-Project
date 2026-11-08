import cron, { ScheduledTask } from 'node-cron';
import { buildApp } from './app.js';
import { config } from './config.js';
import { DigestService } from './services/digestService.js';

async function startServer() {
  const app = await buildApp();

  let digestTask: ScheduledTask | null = null;
  let digestRunning = false;

  // Daily owner digest at 21:30 EAT (configurable). The service records real
  // channel outcomes; it does not claim delivery when no carrier was used.
  if (config.NODE_ENV !== 'test' && cron.validate(config.DIGEST_CRON_SCHEDULE)) {
    digestTask = cron.schedule(
      config.DIGEST_CRON_SCHEDULE,
      async () => {
        if (digestRunning) {
          app.log.warn('Digest dispatch is still running; skipping this tick.');
          return;
        }
        digestRunning = true;
        try {
          const result = await DigestService.dispatchDigest(app.prisma);
          app.log.info(
            {
              digestId: result.digestId,
              status: result.status,
              smsStatus: result.smsStatus,
              emailStatus: result.emailStatus,
              channelsSent: result.channelsSent
            },
            'Scheduled daily digest completed'
          );
        } catch (err) {
          app.log.error({ err }, 'Scheduled daily digest failed');
        } finally {
          digestRunning = false;
        }
      },
      { timezone: 'Africa/Kampala' }
    );
    app.log.info(
      { schedule: config.DIGEST_CRON_SCHEDULE, timezone: 'Africa/Kampala' },
      'Daily digest cron registered'
    );
  } else if (config.NODE_ENV !== 'test') {
    app.log.error(
      { schedule: config.DIGEST_CRON_SCHEDULE },
      'DIGEST_CRON_SCHEDULE is invalid; scheduled digest disabled'
    );
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Gracefully stopping Fastify server...`);
    try {
      digestTask?.stop();
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
    console.log(`Foodizo & Obunuzi Fastify Engine listening on: ${address}`);
    console.log(`Environment: ${config.NODE_ENV}`);
    console.log(`WebSocket Event Bus: ws://${config.HOST}:${config.PORT}/ws/events`);
    console.log(
      `Daily digest cron: ${config.DIGEST_CRON_SCHEDULE} Africa/Kampala (${app ? 'registered' : 'off'})`
    );
    console.log(`===============================================================\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

startServer();
