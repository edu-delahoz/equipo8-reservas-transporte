import pino from 'pino';
import { config } from '../config.js';

const targets = [{ target: 'pino/file', options: { destination: 1 }, level: 'info' }];
if (config.lokiUrl) {
  targets.push({
    target: 'pino-loki',
    level: 'info',
    options: {
      host: config.lokiUrl,
      batching: { interval: 2 },
      labels: { app: 'api-reservas', entorno: process.env.NODE_ENV ?? 'desarrollo' },
      propsToLabels: ['level'],
    },
  });
}

export const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' }, pino.transport({ targets }));
