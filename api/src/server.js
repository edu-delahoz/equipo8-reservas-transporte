import { crearApp } from './app.js';
import { config } from './config.js';
import { redis } from './lib/cache.js';
import { esperarBaseDeDatos, pool } from './lib/db.js';
import { logger } from './lib/logger.js';

await esperarBaseDeDatos();
const servidor = crearApp().listen(config.puerto, () => logger.info({ puerto: config.puerto }, 'API de reservas escuchando'));

for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, () => {
    logger.info({ senal }, 'Apagando');
    servidor.close(async () => {
      await Promise.allSettled([pool.end(), redis.quit()]);
      process.exit(0);
    });
  });
}
