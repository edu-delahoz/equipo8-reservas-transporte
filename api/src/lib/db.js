import pg from 'pg';
import { config } from '../config.js';
import { logger } from './logger.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

pool.on('error', (err) => logger.error({ err }, 'Error en el pool de PostgreSQL'));

export async function esperarBaseDeDatos(intentos = 30) {
  for (let i = 1; i <= intentos; i++) {
    try {
      await pool.query('SELECT 1');
      logger.info('Conectado a PostgreSQL');
      return;
    } catch (err) {
      logger.warn({ intento: i, err: err.message }, 'PostgreSQL no disponible, reintentando');
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('No fue posible conectar con PostgreSQL');
}
