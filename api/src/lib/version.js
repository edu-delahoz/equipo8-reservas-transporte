import { config } from '../config.js';
import { enviarProblema } from './errores.js';

/** Versionamiento por Custom Request Header: X-API-Version: 1 | 2 */
export function versionado(req, res, next) {
  res.vary('X-API-Version');
  const crudo = req.get('X-API-Version');
  const version = crudo === undefined || crudo.trim() === '' ? config.versionPorDefecto : crudo.trim().replace(/^v/i, '');
  if (!config.versionesSoportadas.includes(version)) {
    return enviarProblema(req, res, 400, 'Versión de API no soportada', `La versión '${crudo}' no existe. Envíe el header X-API-Version con uno de: ${config.versionesSoportadas.join(', ')}`, {
      versionesSoportadas: config.versionesSoportadas,
    });
  }
  req.apiVersion = Number(version);
  res.setHeader('X-API-Version', version);
  next();
}
