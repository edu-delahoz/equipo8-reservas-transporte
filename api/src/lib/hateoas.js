import { DESCRIPCION_ESTADO, TRANSICIONES } from './dominio.js';

// Representaciones HAL (Hypertext Application Language): _links + _embedded.
// Los enlaces no llevan versión: la versión viaja en el header X-API-Version.

export const urlBase = (req) => `${req.protocol}://${req.get('host')}/api`;

const link = (href, extra = {}) => ({ href, ...extra });

function enlacesReserva(req, r) {
  const base = urlBase(req);
  const self = `${base}/reservas/${r.numeroReserva}`;
  const links = {
    self: link(self),
    vehiculo: link(`${base}/vehiculos/${r.placa}`),
    'reservas-del-vehiculo': link(`${base}/reservas?placa=${r.placa}`),
    coleccion: link(`${base}/reservas`),
  };
  // Las acciones disponibles dependen del estado actual (HATEOAS como motor del estado de la aplicación)
  for (const [hacia, rel] of Object.entries(TRANSICIONES[r.estado])) {
    links[rel] = link(self, { method: 'PATCH', type: 'application/json', body: { estado: hacia } });
  }
  return links;
}

export function representarReserva(req, r) {
  if (req.apiVersion === 1) {
    return {
      numeroReserva: r.numeroReserva,
      estado: r.estado,
      placa: r.placa,
      conductor: r.vehiculo.conductor.nombre,
      pasajeroNombre: r.pasajero.nombre,
      pasajeroTelefono: r.pasajero.telefono,
      origen: r.origen.direccion,
      destino: r.destino.direccion,
      fechaHoraRecogida: r.fechaHoraRecogida,
      numPasajeros: r.numPasajeros,
      tipoServicio: r.tipoServicio,
      metodoPago: r.metodoPago,
      tarifaEstimada: r.tarifaEstimada,
      creadaEn: r.creadaEn,
      _links: enlacesReserva(req, r),
    };
  }
  // v2: recursos anidados, estado con descripción, tarifa con moneda y vehículo embebido
  return {
    numeroReserva: r.numeroReserva,
    estado: { codigo: r.estado, descripcion: DESCRIPCION_ESTADO[r.estado] },
    pasajero: r.pasajero,
    ruta: { origen: r.origen, destino: r.destino, distanciaKm: r.distanciaKm },
    recogida: { fechaHora: r.fechaHoraRecogida, numPasajeros: r.numPasajeros },
    servicio: { tipo: r.tipoServicio, metodoPago: r.metodoPago },
    tarifa: { valor: r.tarifaEstimada, moneda: 'COP' },
    observaciones: r.observaciones,
    auditoria: { creadaEn: r.creadaEn, actualizadaEn: r.actualizadaEn },
    _embedded: { vehiculo: r.vehiculo },
    _links: enlacesReserva(req, r),
  };
}

export function representarVehiculo(req, v) {
  const base = urlBase(req);
  const _links = {
    self: link(`${base}/vehiculos/${v.placa}`),
    reservas: link(`${base}/reservas?placa=${v.placa}`),
    'crear-reserva': link(`${base}/reservas`, { method: 'POST', type: 'application/json' }),
    coleccion: link(`${base}/vehiculos`),
  };
  if (req.apiVersion === 1) {
    return {
      placa: v.placa,
      marca: v.marca,
      modelo: v.modelo,
      color: v.color,
      tipoServicio: v.tipoServicio,
      capacidad: v.capacidad,
      conductorNombre: v.conductor.nombre,
      activo: v.activo,
      _links,
    };
  }
  return { ...v, _links };
}

/** Colección paginada HAL con enlaces first/prev/next/last que conservan los filtros. */
export function representarColeccion(req, { nombre, ruta, items, total, page, size, filtros = {} }) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  const url = (p) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) if (v) qs.set(k, v);
    qs.set('page', p);
    qs.set('size', size);
    return `${urlBase(req)}/${ruta}?${qs}`;
  };
  const _links = { self: link(url(page)), first: link(url(1)), last: link(url(totalPages)) };
  if (page > 1) _links.prev = link(url(Math.min(page - 1, totalPages)));
  if (page < totalPages) _links.next = link(url(page + 1));
  return {
    _embedded: { [nombre]: items },
    page: { number: page, size, totalElements: total, totalPages },
    _links,
  };
}
