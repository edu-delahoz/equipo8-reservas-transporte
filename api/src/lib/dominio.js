import { config } from '../config.js';
import { ErrorApi } from './errores.js';

export const TIPOS_SERVICIO = ['ECONOMICO', 'CONFORT', 'XL'];
export const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'NEQUI', 'DAVIPLATA'];
export const ESTADOS = ['PENDIENTE', 'CONFIRMADA', 'CONDUCTOR_EN_CAMINO', 'EN_CURSO', 'FINALIZADA', 'CANCELADA'];

export const DESCRIPCION_ESTADO = {
  PENDIENTE: 'Reserva recibida, esperando que el conductor la acepte',
  CONFIRMADA: 'El conductor aceptó la reserva',
  CONDUCTOR_EN_CAMINO: 'El conductor va hacia el punto de recogida',
  EN_CURSO: 'El pasajero está en el vehículo',
  FINALIZADA: 'El viaje terminó',
  CANCELADA: 'La reserva fue cancelada',
};

// Máquina de estados: qué transición está permitida desde cada estado y con qué "rel" se anuncia en HATEOAS
export const TRANSICIONES = {
  PENDIENTE: { CONFIRMADA: 'confirmar', CANCELADA: 'cancelar' },
  CONFIRMADA: { CONDUCTOR_EN_CAMINO: 'conductor-en-camino', CANCELADA: 'cancelar' },
  CONDUCTOR_EN_CAMINO: { EN_CURSO: 'iniciar-viaje', CANCELADA: 'cancelar' },
  EN_CURSO: { FINALIZADA: 'finalizar' },
  FINALIZADA: {},
  CANCELADA: {},
};

export const ESTADOS_ACTIVOS = ['PENDIENTE', 'CONFIRMADA', 'CONDUCTOR_EN_CAMINO', 'EN_CURSO'];

const TARIFA = { base: 4000, minima: 7000, porKm: { ECONOMICO: 1800, CONFORT: 2500, XL: 3200 } };

export const RE_PLACA = /^[A-Z]{3}\d{3}$/;
export const RE_NUMERO = /^RSV-\d{6}$/;

export function distanciaKm(o, d) {
  const rad = (x) => (x * Math.PI) / 180;
  const a =
    Math.sin(rad(d.lat - o.lat) / 2) ** 2 + Math.cos(rad(o.lat)) * Math.cos(rad(d.lat)) * Math.sin(rad(d.lng - o.lng) / 2) ** 2;
  const lineaRecta = 6371 * 2 * Math.asin(Math.sqrt(a));
  return Math.round(lineaRecta * 1.3 * 100) / 100; // factor 1.3: recorrido por calles vs. línea recta
}

export function tarifaEstimada(tipoServicio, km) {
  const valor = TARIFA.base + km * TARIFA.porKm[tipoServicio];
  return Math.max(TARIFA.minima, Math.round(valor / 100) * 100);
}

export function normalizarPlaca(valor) {
  return typeof valor === 'string' ? valor.trim().toUpperCase().replace(/[\s-]/g, '') : valor;
}

export function paginacion(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const size = query.size === undefined ? config.paginaTamanoDefecto : Number(query.size);
  const errores = [];
  if (!Number.isInteger(page) || page < 1) errores.push({ campo: 'page', mensaje: 'Debe ser un entero ≥ 1' });
  if (!Number.isInteger(size) || size < 1 || size > config.paginaTamanoMaximo)
    errores.push({ campo: 'size', mensaje: `Debe ser un entero entre 1 y ${config.paginaTamanoMaximo}` });
  if (errores.length) throw new ErrorApi(400, 'Parámetros de paginación inválidos', 'Revise page y size', { errores });
  return { page, size };
}

const texto = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
const coordenada = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

function validarPunto(nombre, p, errores) {
  if (!p || typeof p !== 'object') return errores.push({ campo: nombre, mensaje: 'Es obligatorio (direccion, lat, lng)' });
  if (!texto(p.direccion, 3, 200)) errores.push({ campo: `${nombre}.direccion`, mensaje: 'Texto de 3 a 200 caracteres' });
  if (!coordenada(p.lat, -90, 90)) errores.push({ campo: `${nombre}.lat`, mensaje: 'Número entre -90 y 90' });
  if (!coordenada(p.lng, -180, 180)) errores.push({ campo: `${nombre}.lng`, mensaje: 'Número entre -180 y 180' });
}

/** Valida el cuerpo del POST /reservas. Devuelve la reserva normalizada o lanza 422. */
export function validarNuevaReserva(b) {
  const errores = [];
  if (!b || typeof b !== 'object' || Array.isArray(b)) {
    throw new ErrorApi(422, 'Reserva inválida', 'El cuerpo debe ser un objeto JSON');
  }
  const placa = b.placa === undefined || b.placa === null || b.placa === '' ? null : normalizarPlaca(b.placa);
  if (placa !== null && !RE_PLACA.test(placa)) errores.push({ campo: 'placa', mensaje: 'Formato de placa colombiana: ABC123' });
  if (!TIPOS_SERVICIO.includes(b.tipoServicio)) errores.push({ campo: 'tipoServicio', mensaje: `Uno de: ${TIPOS_SERVICIO.join(', ')}` });
  if (!METODOS_PAGO.includes(b.metodoPago)) errores.push({ campo: 'metodoPago', mensaje: `Uno de: ${METODOS_PAGO.join(', ')}` });

  const p = b.pasajero;
  if (!p || typeof p !== 'object') errores.push({ campo: 'pasajero', mensaje: 'Es obligatorio (nombre, documento, telefono, email)' });
  else {
    if (!texto(p.nombre, 3, 100)) errores.push({ campo: 'pasajero.nombre', mensaje: 'Texto de 3 a 100 caracteres' });
    if (typeof p.documento !== 'string' || !/^\d{6,12}$/.test(p.documento)) errores.push({ campo: 'pasajero.documento', mensaje: 'Entre 6 y 12 dígitos' });
    if (typeof p.telefono !== 'string' || !/^\+?\d{7,15}$/.test(p.telefono)) errores.push({ campo: 'pasajero.telefono', mensaje: 'Entre 7 y 15 dígitos, opcional +' });
    if (p.email !== undefined && (typeof p.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)))
      errores.push({ campo: 'pasajero.email', mensaje: 'Correo electrónico inválido' });
  }
  validarPunto('origen', b.origen, errores);
  validarPunto('destino', b.destino, errores);

  const fecha = new Date(b.fechaHoraRecogida);
  if (typeof b.fechaHoraRecogida !== 'string' || Number.isNaN(fecha.getTime()))
    errores.push({ campo: 'fechaHoraRecogida', mensaje: 'Fecha ISO-8601, p. ej. 2026-12-01T08:30:00-05:00' });
  else if (fecha.getTime() < Date.now() - 60_000) errores.push({ campo: 'fechaHoraRecogida', mensaje: 'No puede estar en el pasado' });
  else if (fecha.getTime() > Date.now() + 90 * 24 * 3600_000) errores.push({ campo: 'fechaHoraRecogida', mensaje: 'Máximo 90 días de anticipación' });

  if (!Number.isInteger(b.numPasajeros) || b.numPasajeros < 1 || b.numPasajeros > 8)
    errores.push({ campo: 'numPasajeros', mensaje: 'Entero entre 1 y 8' });
  if (b.observaciones !== undefined && b.observaciones !== null && !texto(b.observaciones, 0, 300))
    errores.push({ campo: 'observaciones', mensaje: 'Máximo 300 caracteres' });

  if (errores.length) throw new ErrorApi(422, 'Reserva inválida', 'Uno o más campos no cumplen las reglas', { errores });

  const km = distanciaKm(b.origen, b.destino);
  if (km < 0.3) throw new ErrorApi(422, 'Reserva inválida', 'El origen y el destino están demasiado cerca', { errores: [{ campo: 'destino', mensaje: 'Debe estar a más de 300 m del origen' }] });

  return {
    placa,
    tipoServicio: b.tipoServicio,
    metodoPago: b.metodoPago,
    pasajero: { nombre: p.nombre.trim(), documento: p.documento, telefono: p.telefono, email: p.email ?? null },
    origen: { direccion: b.origen.direccion.trim(), lat: b.origen.lat, lng: b.origen.lng },
    destino: { direccion: b.destino.direccion.trim(), lat: b.destino.lat, lng: b.destino.lng },
    fechaHoraRecogida: fecha.toISOString(),
    numPasajeros: b.numPasajeros,
    observaciones: b.observaciones?.trim() || null,
    distanciaKm: km,
    tarifaEstimada: tarifaEstimada(b.tipoServicio, km),
  };
}
