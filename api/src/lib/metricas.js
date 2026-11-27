import client from 'prom-client';
import { pool } from './db.js';

export const registro = new client.Registry();
registro.setDefaultLabels({ app: 'api-reservas' });
client.collectDefaultMetrics({ register: registro });

export const duracionHttp = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de las peticiones HTTP',
  labelNames: ['method', 'route', 'status_code', 'api_version'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registro],
});

export const peticionesHttp = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de peticiones HTTP',
  labelNames: ['method', 'route', 'status_code', 'api_version'],
  registers: [registro],
});

export const operacionesCache = new client.Counter({
  name: 'cache_operations_total',
  help: 'Lecturas de caché Redis por resultado (hit/miss/error)',
  labelNames: ['entidad', 'resultado'],
  registers: [registro],
});

export const reservasCreadas = new client.Counter({
  name: 'reservas_creadas_total',
  help: 'Reservas creadas por tipo de servicio',
  labelNames: ['tipo_servicio'],
  registers: [registro],
});

export const transicionesEstado = new client.Counter({
  name: 'reservas_transiciones_total',
  help: 'Cambios de estado de reservas',
  labelNames: ['desde', 'hacia'],
  registers: [registro],
});

// Métrica de negocio calculada en cada scrape
new client.Gauge({
  name: 'reservas_por_estado',
  help: 'Número actual de reservas en cada estado',
  labelNames: ['estado'],
  registers: [registro],
  async collect() {
    try {
      const { rows } = await pool.query('SELECT estado, count(*)::int AS n FROM reserva GROUP BY estado');
      this.reset();
      for (const r of rows) this.set({ estado: r.estado }, r.n);
    } catch {
      /* si la BD no responde, se omite la métrica en este scrape */
    }
  },
});

export function middlewareMetricas(req, res, next) {
  const fin = duracionHttp.startTimer();
  res.on('finish', () => {
    const route = req.route ? `${req.baseUrl}${req.route.path}` : res.statusCode === 404 ? 'no_encontrada' : 'otra';
    const etiquetas = {
      method: req.method,
      route,
      status_code: res.statusCode,
      api_version: req.apiVersion ? `v${req.apiVersion}` : 'n/a',
    };
    fin(etiquetas);
    peticionesHttp.inc(etiquetas);
  });
  next();
}
