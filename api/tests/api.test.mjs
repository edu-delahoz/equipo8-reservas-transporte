// Pruebas de integración contra el stack levantado con docker compose.
// Uso: BASE_URL=http://localhost:3000 node --test tests/
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const BASE = `${process.env.BASE_URL ?? 'http://localhost:3000'}/api`;

async function api(ruta, { version, method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${ruta}`, {
    method,
    headers: { ...(version ? { 'X-API-Version': version } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: typeof body === 'string' ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, headers: res.headers, datos: await res.json().catch(() => null) };
}

// Cada ejecución usa una hora distinta para no chocar con reservas de ejecuciones anteriores
const horaUnica = (offsetHoras) => new Date(Date.now() + (24 * 30 + offsetHoras) * 3600_000 + Math.floor(Math.random() * 400) * 3 * 3600_000).toISOString();

const nueva = (extra = {}) => ({
  tipoServicio: 'CONFORT',
  metodoPago: 'NEQUI',
  pasajero: { nombre: 'Prueba Automatizada', documento: '1000000001', telefono: '3000000001', email: 'prueba@correo.com' },
  origen: { direccion: 'Universidad de Antioquia', lat: 6.2677, lng: -75.5688 },
  destino: { direccion: 'Parque Lleras', lat: 6.2085, lng: -75.567 },
  fechaHoraRecogida: horaUnica(0),
  numPasajeros: 2,
  ...extra,
});

describe('Versionamiento por Custom Request Header', () => {
  it('sin header usa la versión 1 y la informa', async () => {
    const r = await api('/reservas/RSV-000001');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('x-api-version'), '1');
    assert.equal(typeof r.datos.estado, 'string');
  });
  it('X-API-Version: 2 devuelve la representación anidada', async () => {
    const r = await api('/reservas/RSV-000001', { version: '2' });
    assert.equal(r.headers.get('x-api-version'), '2');
    assert.ok(r.datos.estado.codigo && r.datos.estado.descripcion);
    assert.equal(r.datos.tarifa.moneda, 'COP');
    assert.ok(r.datos._embedded.vehiculo.conductor);
  });
  it('una versión desconocida responde 400 con las versiones soportadas', async () => {
    const r = await api('/reservas', { version: '99' });
    assert.equal(r.status, 400);
    assert.deepEqual(r.datos.versionesSoportadas, ['1', '2']);
  });
  it('declara Vary: X-API-Version para cachés intermedias', async () => {
    const r = await api('/reservas/RSV-000001', { version: '1' });
    assert.match(r.headers.get('vary'), /X-API-Version/i);
  });
});

describe('GET reservas por placa o número', () => {
  it('por placa devuelve página HAL con enlaces de paginación', async () => {
    const r = await api('/reservas?placa=ABC123&size=3', { version: '1' });
    assert.equal(r.status, 200);
    assert.equal(r.datos.page.size, 3);
    assert.ok(r.datos.page.totalElements > 3);
    assert.ok(r.datos._embedded.reservas.every((x) => x.placa === 'ABC123'));
    assert.ok(r.datos._links.self && r.datos._links.first && r.datos._links.next && r.datos._links.last);
    assert.equal(r.datos._links.prev, undefined);
  });
  it('el enlace next lleva a la página 2 conservando el filtro', async () => {
    const p1 = await api('/reservas?placa=ABC123&size=3', { version: '1' });
    const next = new URL(p1.datos._links.next.href);
    assert.equal(next.searchParams.get('placa'), 'ABC123');
    const p2 = await api(`/reservas${next.search}`, { version: '1' });
    assert.equal(p2.datos.page.number, 2);
    assert.ok(p2.datos._links.prev);
  });
  it('acepta la placa en minúsculas y con guion', async () => {
    const r = await api('/reservas?placa=abc-123', { version: '1' });
    assert.equal(r.status, 200);
  });
  it('por número de reserva (ruta) devuelve el estado', async () => {
    const r = await api('/reservas/RSV-000050', { version: '1' });
    assert.equal(r.status, 200);
    assert.equal(r.datos.numeroReserva, 'RSV-000050');
    assert.ok(r.datos.estado);
  });
  it('por número de reserva (query) devuelve una colección de un elemento', async () => {
    const r = await api('/reservas?numero=RSV-000050', { version: '1' });
    assert.equal(r.datos.page.totalElements, 1);
  });
  it('404 si la placa no está registrada', async () => {
    assert.equal((await api('/reservas?placa=ZZZ999')).status, 404);
  });
  it('404 si la reserva no existe', async () => {
    const r = await api('/reservas/RSV-999999');
    assert.equal(r.status, 404);
    assert.equal(r.headers.get('content-type').split(';')[0], 'application/problem+json');
  });
  it('400 si la placa o el número tienen mal formato', async () => {
    assert.equal((await api('/reservas?placa=12')).status, 400);
    assert.equal((await api('/reservas/12345')).status, 400);
  });
  it('400 si la paginación es inválida', async () => {
    assert.equal((await api('/reservas?page=0')).status, 400);
    assert.equal((await api('/reservas?size=500')).status, 400);
  });
});

describe('Caché Redis', () => {
  it('la segunda lectura sale de la caché (X-Cache: HIT)', async () => {
    const ruta = `/reservas?placa=STU901&size=${1 + Math.floor(Math.random() * 40)}`;
    const a = await api(ruta, { version: '1' });
    const b = await api(ruta, { version: '1' });
    assert.equal(a.headers.get('x-cache'), 'MISS');
    assert.equal(b.headers.get('x-cache'), 'HIT');
  });
});

describe('POST nueva reserva', () => {
  it('201 con Location, estado PENDIENTE, tarifa calculada y enlaces de acción', async () => {
    const r = await api('/reservas', { version: '2', method: 'POST', body: nueva() });
    assert.equal(r.status, 201);
    assert.equal(r.headers.get('location'), r.datos._links.self.href);
    assert.equal(r.datos.estado.codigo, 'PENDIENTE');
    assert.ok(r.datos.tarifa.valor >= 7000);
    assert.equal(r.datos._embedded.vehiculo.placa.length, 6);
    assert.equal(r.datos._links.confirmar.method, 'PATCH');
    assert.ok(r.datos._links.cancelar);
  });
  it('la reserva creada aparece al consultar su placa (la caché se invalida)', async () => {
    const creada = await api('/reservas', { version: '1', method: 'POST', body: nueva({ fechaHoraRecogida: horaUnica(5) }) });
    const lista = await api(`/reservas?placa=${creada.datos.placa}&numero=${creada.datos.numeroReserva}`, { version: '1' });
    assert.equal(lista.datos.page.totalElements, 1);
  });
  it('409 si el vehículo ya tiene una reserva a menos de una hora', async () => {
    const fecha = horaUnica(10);
    const a = await api('/reservas', { version: '1', method: 'POST', body: nueva({ placa: 'JKL012', fechaHoraRecogida: fecha }) });
    assert.equal(a.status, 201);
    const b = await api('/reservas', { version: '1', method: 'POST', body: nueva({ placa: 'JKL012', fechaHoraRecogida: fecha }) });
    assert.equal(b.status, 409);
    assert.equal(b.datos.reservaEnConflicto, a.datos.numeroReserva);
  });
  it('422 con la lista de campos inválidos', async () => {
    const r = await api('/reservas', { method: 'POST', body: { tipoServicio: 'MOTO', numPasajeros: 0 } });
    assert.equal(r.status, 422);
    const campos = r.datos.errores.map((e) => e.campo);
    for (const c of ['tipoServicio', 'metodoPago', 'pasajero', 'origen', 'destino', 'fechaHoraRecogida', 'numPasajeros']) assert.ok(campos.includes(c), c);
  });
  it('422 si la fecha está en el pasado', async () => {
    const r = await api('/reservas', { method: 'POST', body: nueva({ fechaHoraRecogida: '2020-01-01T10:00:00Z' }) });
    assert.equal(r.status, 422);
  });
  it('422 si la placa no existe o no coincide con el tipo de servicio', async () => {
    assert.equal((await api('/reservas', { method: 'POST', body: nueva({ placa: 'ZZZ999' }) })).status, 422);
    assert.equal((await api('/reservas', { method: 'POST', body: nueva({ placa: 'ABC123' }) })).status, 422);
  });
  it('415 si no se envía JSON', async () => {
    const r = await api('/reservas', { method: 'POST', body: 'hola', headers: { 'Content-Type': 'text/plain' } });
    assert.equal(r.status, 415);
  });
  it('400 si el JSON está mal formado', async () => {
    const r = await api('/reservas', { method: 'POST', body: '{"tipoServicio":' });
    assert.equal(r.status, 400);
  });
});

describe('HATEOAS: transiciones de estado guiadas por enlaces', () => {
  it('sigue los enlaces confirmar → conductor-en-camino → iniciar-viaje → finalizar', async () => {
    let r = await api('/reservas', { version: '1', method: 'POST', body: nueva({ fechaHoraRecogida: horaUnica(15) }) });
    for (const rel of ['confirmar', 'conductor-en-camino', 'iniciar-viaje', 'finalizar']) {
      const link = r.datos._links[rel];
      assert.ok(link, `falta el enlace ${rel}`);
      r = await api(new URL(link.href).pathname.replace('/api', ''), { version: '1', method: link.method, body: link.body });
      assert.equal(r.status, 200);
    }
    assert.equal(r.datos.estado, 'FINALIZADA');
    assert.equal(r.datos._links.cancelar, undefined, 'una reserva finalizada no ofrece acciones');
  });
  it('409 si la transición no está permitida', async () => {
    const r = await api('/reservas', { version: '1', method: 'POST', body: nueva({ fechaHoraRecogida: horaUnica(20) }) });
    const p = await api(`/reservas/${r.datos.numeroReserva}`, { method: 'PATCH', body: { estado: 'FINALIZADA' } });
    assert.equal(p.status, 409);
    assert.deepEqual(p.datos.transicionesPermitidas.sort(), ['CANCELADA', 'CONFIRMADA']);
  });
});

describe('Raíz, vehículos y salud', () => {
  it('la raíz /api anuncia los recursos con enlaces templated', async () => {
    const r = await api('/');
    assert.equal(r.datos._links.reservas.templated, true);
  });
  it('GET /vehiculos pagina y filtra por tipo', async () => {
    const r = await api('/vehiculos?tipoServicio=XL', { version: '2' });
    assert.ok(r.datos._embedded.vehiculos.every((v) => v.tipoServicio === 'XL'));
  });
  it('GET /vehiculos/{placa} 200 y 404', async () => {
    assert.equal((await api('/vehiculos/ABC123')).status, 200);
    assert.equal((await api('/vehiculos/ZZZ999')).status, 404);
  });
  it('/health y /metrics responden', async () => {
    const base = BASE.replace(/\/api$/, '');
    assert.equal((await fetch(`${base}/health`)).status, 200);
    const m = await (await fetch(`${base}/metrics`)).text();
    assert.match(m, /http_requests_total/);
    assert.match(m, /reservas_por_estado/);
  });
});
