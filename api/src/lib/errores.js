// Errores con formato "Problem Details" (RFC 9457): application/problem+json
export class ErrorApi extends Error {
  constructor(status, titulo, detalle, extra = {}) {
    super(detalle ?? titulo);
    this.status = status;
    this.titulo = titulo;
    this.detalle = detalle;
    this.extra = extra;
  }
}

export function enviarProblema(req, res, status, titulo, detalle, extra = {}) {
  res
    .status(status)
    .type('application/problem+json')
    .json({
      type: `https://httpstatuses.io/${status}`,
      title: titulo,
      status,
      detail: detalle,
      instance: req.originalUrl,
      requestId: req.id,
      ...extra,
    });
}

export function noEncontrado(req, res) {
  enviarProblema(req, res, 404, 'Recurso no encontrado', `No existe la ruta ${req.method} ${req.originalUrl}`);
}

// eslint-disable-next-line no-unused-vars
export function manejadorErrores(err, req, res, _next) {
  if (err instanceof ErrorApi) {
    return enviarProblema(req, res, err.status, err.titulo, err.detalle, err.extra);
  }
  if (err.type === 'entity.parse.failed') {
    return enviarProblema(req, res, 400, 'JSON mal formado', 'El cuerpo de la petición no es un JSON válido');
  }
  if (err.type === 'entity.too.large') {
    return enviarProblema(req, res, 413, 'Cuerpo demasiado grande', 'El cuerpo supera el tamaño permitido (20 KB)');
  }
  req.log?.error({ err }, 'Error no controlado');
  enviarProblema(req, res, 500, 'Error interno', 'Ocurrió un error inesperado. Use el requestId para rastrearlo en los logs.');
}
