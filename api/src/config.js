export const config = {
  puerto: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://reservas:reservas@localhost:5432/reservas',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  lokiUrl: process.env.LOKI_URL ?? '',
  cacheTtlSegundos: Number(process.env.CACHE_TTL_SECONDS ?? 60),
  versionesSoportadas: ['1', '2'],
  versionPorDefecto: '1',
  paginaTamanoDefecto: 10,
  paginaTamanoMaximo: 50,
};
