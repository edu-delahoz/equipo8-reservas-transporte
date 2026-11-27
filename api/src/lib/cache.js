import { Redis } from 'ioredis';
import { config } from '../config.js';
import { logger } from './logger.js';
import { operacionesCache } from './metricas.js';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: false,
});
redis.on('error', (err) => logger.warn({ err: err.message }, 'Redis no disponible'));
redis.on('ready', () => logger.info('Conectado a Redis'));

/**
 * Cache-aside: busca en Redis y, si no está, ejecuta `cargar` y guarda el resultado.
 * Si Redis falla, la API sigue funcionando contra la BD (degradación controlada).
 */
export async function obtenerConCache(clave, entidad, cargar, ttl = config.cacheTtlSegundos) {
  try {
    const guardado = await redis.get(clave);
    if (guardado !== null) {
      operacionesCache.inc({ entidad, resultado: 'hit' });
      return { valor: JSON.parse(guardado), hit: true };
    }
    operacionesCache.inc({ entidad, resultado: 'miss' });
  } catch {
    operacionesCache.inc({ entidad, resultado: 'error' });
  }
  const valor = await cargar();
  if (valor !== null && valor !== undefined) {
    redis.set(clave, JSON.stringify(valor), 'EX', ttl).catch(() => {});
  }
  return { valor, hit: false };
}

// Generación de las listas: al escribir se incrementa y las claves viejas expiran solas (sin SCAN).
export async function generacion(nombre) {
  try {
    return (await redis.get(`cache:gen:${nombre}`)) ?? '0';
  } catch {
    return 'sin-redis';
  }
}

export async function invalidar({ claves = [], generaciones = [] }) {
  try {
    const p = redis.multi();
    if (claves.length) p.del(...claves);
    for (const g of generaciones) p.incr(`cache:gen:${g}`);
    await p.exec();
  } catch (err) {
    logger.warn({ err: err.message }, 'No se pudo invalidar la caché');
  }
}
