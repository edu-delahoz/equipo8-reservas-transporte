import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import cors from 'cors';
import express from 'express';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { redis } from './lib/cache.js';
import { pool } from './lib/db.js';
import { manejadorErrores, noEncontrado } from './lib/errores.js';
import { urlBase } from './lib/hateoas.js';
import { logger } from './lib/logger.js';
import { middlewareMetricas, registro } from './lib/metricas.js';
import { versionado } from './lib/version.js';
import { rutasReservas } from './routes/reservas.js';
import { rutasVehiculos } from './routes/vehiculos.js';

const especificacion = YAML.parse(readFileSync(new URL('../openapi.yaml', import.meta.url), 'utf8'));

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(cors({ exposedHeaders: ['X-API-Version', 'X-Cache', 'X-Request-Id', 'Location'] }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = req.get('X-Request-Id') ?? randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => ['/metrics', '/health'].includes(req.url) },
      customProps: (req) => ({ apiVersion: req.apiVersion, ruta: req.route?.path }),
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    }),
  );
  app.use(middlewareMetricas);

  app.get('/health', async (_req, res) => {
    const comprobar = async (fn) => {
      try {
        await fn();
        return 'UP';
      } catch {
        return 'DOWN';
      }
    };
    const [db, cache] = await Promise.all([comprobar(() => pool.query('SELECT 1')), comprobar(() => redis.ping())]);
    // Redis caído degrada pero no tumba el servicio
    res.status(db === 'UP' ? 200 : 503).json({ status: db === 'UP' ? 'UP' : 'DOWN', componentes: { postgres: db, redis: cache } });
  });

  app.get('/metrics', async (_req, res) => {
    res.type(registro.contentType).send(await registro.metrics());
  });

  app.get('/api-docs.json', (_req, res) => res.json(especificacion));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(especificacion, { customSiteTitle: 'API Reservas de Transporte' }));

  const api = express.Router();
  api.use(express.json({ limit: '20kb' }), versionado);
  api.get('/', (req, res) => {
    const base = urlBase(req);
    res.json({
      nombre: 'API de reservas de transporte',
      version: req.apiVersion,
      _links: {
        self: { href: base },
        reservas: { href: `${base}/reservas{?placa,numero,estado,page,size}`, templated: true },
        reserva: { href: `${base}/reservas/{numeroReserva}`, templated: true },
        'crear-reserva': { href: `${base}/reservas`, method: 'POST', type: 'application/json' },
        vehiculos: { href: `${base}/vehiculos{?tipoServicio,page,size}`, templated: true },
        vehiculo: { href: `${base}/vehiculos/{placa}`, templated: true },
        documentacion: { href: `${req.protocol}://${req.get('host')}/api-docs` },
      },
    });
  });
  api.use('/reservas', rutasReservas);
  api.use('/vehiculos', rutasVehiculos);
  app.use('/api', api);

  app.use(noEncontrado);
  app.use(manejadorErrores);
  return app;
}
