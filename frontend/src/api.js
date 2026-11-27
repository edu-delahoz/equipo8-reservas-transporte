// Cliente mínimo: siempre envía X-API-Version y devuelve también los headers útiles.
export async function llamar(url, { version, method = 'GET', body } = {}) {
  const inicio = performance.now();
  const res = await fetch(url, {
    method,
    headers: { Accept: 'application/json', 'X-API-Version': version, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const datos = await res.json().catch(() => null);
  return {
    ok: res.ok,
    status: res.status,
    datos,
    ms: Math.round(performance.now() - inicio),
    headers: {
      version: res.headers.get('X-API-Version'),
      cache: res.headers.get('X-Cache'),
      location: res.headers.get('Location'),
      requestId: res.headers.get('X-Request-Id'),
    },
  };
}

// Los enlaces HATEOAS son absolutos; en el navegador se usan como rutas relativas al mismo origen.
export const ruta = (href) => {
  const u = new URL(href);
  return u.pathname + u.search;
};

// Normaliza la representación v1 (plana) y v2 (anidada) para pintarlas igual.
export function vistaReserva(r) {
  if (typeof r.estado === 'string') {
    return {
      numero: r.numeroReserva, estado: r.estado, descripcion: null, placa: r.placa, conductor: r.conductor,
      pasajero: r.pasajeroNombre, origen: r.origen, destino: r.destino, fecha: r.fechaHoraRecogida,
      tarifa: r.tarifaEstimada, tipo: r.tipoServicio, pasajeros: r.numPasajeros, km: null, links: r._links,
    };
  }
  const v = r._embedded.vehiculo;
  return {
    numero: r.numeroReserva, estado: r.estado.codigo, descripcion: r.estado.descripcion, placa: v.placa,
    conductor: `${v.conductor.nombre} · ${v.marca} ${v.modelo} ${v.color}`, pasajero: r.pasajero.nombre,
    origen: r.ruta.origen.direccion, destino: r.ruta.destino.direccion, fecha: r.recogida.fechaHora,
    tarifa: r.tarifa.valor, tipo: r.servicio.tipo, pasajeros: r.recogida.numPasajeros, km: r.ruta.distanciaKm, links: r._links,
  };
}

export const LUGARES = [
  { nombre: 'Universidad de Antioquia, Medellín', lat: 6.2677, lng: -75.5688 },
  { nombre: 'Parque Lleras, El Poblado', lat: 6.2085, lng: -75.567 },
  { nombre: 'Aeropuerto José María Córdova, Rionegro', lat: 6.1645, lng: -75.4231 },
  { nombre: 'Centro Comercial Santafé, Medellín', lat: 6.1964, lng: -75.5738 },
  { nombre: 'Estación Parque Berrío, Medellín', lat: 6.2506, lng: -75.5682 },
  { nombre: 'Pueblito Paisa, Cerro Nutibara', lat: 6.2359, lng: -75.5789 },
  { nombre: 'Aeropuerto Olaya Herrera, Medellín', lat: 6.2199, lng: -75.5906 },
  { nombre: 'Parque Explora, Medellín', lat: 6.2708, lng: -75.5655 },
  { nombre: 'Centro Comercial Viva Envigado', lat: 6.1761, lng: -75.5919 },
  { nombre: 'Terminal del Norte, Medellín', lat: 6.2789, lng: -75.5705 },
];
