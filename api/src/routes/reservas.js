import { Router } from 'express';
import { generacion, invalidar, obtenerConCache } from '../lib/cache.js';
import { ESTADOS, RE_NUMERO, RE_PLACA, normalizarPlaca, paginacion, validarNuevaReserva } from '../lib/dominio.js';
import { ErrorApi } from '../lib/errores.js';
import { representarColeccion, representarReserva, urlBase } from '../lib/hateoas.js';
import { reservasCreadas, transicionesEstado } from '../lib/metricas.js';
import * as repo from '../lib/repositorio.js';

export const rutasReservas = Router();

function exigirJson(req) {
  if (!req.is('application/json')) throw new ErrorApi(415, 'Tipo de contenido no soportado', 'Envíe Content-Type: application/json');
}

function validarNumero(numero) {
  if (!RE_NUMERO.test(numero)) throw new ErrorApi(400, 'Número de reserva inválido', `'${numero}' no tiene el formato RSV-000000`);
}

// GET /api/reservas?placa=ABC123 | ?numero=RSV-000001 [&estado=...] [&page=1&size=10]
rutasReservas.get('/', async (req, res) => {
  const { page, size } = paginacion(req.query);
  const placa = req.query.placa ? normalizarPlaca(req.query.placa) : undefined;
  const numero = req.query.numero?.toUpperCase();
  const estado = req.query.estado?.toUpperCase();
  const errores = [];
  if (placa && !RE_PLACA.test(placa)) errores.push({ campo: 'placa', mensaje: 'Formato ABC123' });
  if (numero && !RE_NUMERO.test(numero)) errores.push({ campo: 'numero', mensaje: 'Formato RSV-000000' });
  if (estado && !ESTADOS.includes(estado)) errores.push({ campo: 'estado', mensaje: `Uno de: ${ESTADOS.join(', ')}` });
  if (errores.length) throw new ErrorApi(400, 'Parámetros de búsqueda inválidos', 'Revise los filtros', { errores });

  const gen = await generacion('reservas');
  const clave = `reservas:lista:g${gen}:${placa ?? '*'}:${numero ?? '*'}:${estado ?? '*'}:${page}:${size}`;
  const { valor, hit } = await obtenerConCache(clave, 'reservas', () => repo.listarReservas({ placa, numero, estado, page, size }));
  res.set('X-Cache', hit ? 'HIT' : 'MISS');
  if (!valor.vehiculoExiste) throw new ErrorApi(404, 'Vehículo no encontrado', `No hay un vehículo registrado con placa ${placa}`);
  res.json(
    representarColeccion(req, {
      nombre: 'reservas',
      ruta: 'reservas',
      items: valor.items.map((r) => representarReserva(req, r)),
      total: valor.total,
      page,
      size,
      filtros: { placa, numero, estado },
    }),
  );
});

// GET /api/reservas/RSV-000001
rutasReservas.get('/:numero', async (req, res) => {
  const numero = req.params.numero.toUpperCase();
  validarNumero(numero);
  const { valor, hit } = await obtenerConCache(`reserva:${numero}`, 'reserva', () => repo.buscarReserva(numero));
  res.set('X-Cache', hit ? 'HIT' : 'MISS');
  if (!valor) throw new ErrorApi(404, 'Reserva no encontrada', `No existe la reserva ${numero}`);
  res.json(representarReserva(req, valor));
});

// POST /api/reservas
rutasReservas.post('/', async (req, res) => {
  exigirJson(req);
  const datos = validarNuevaReserva(req.body);
  const numero = await repo.crearReserva(datos);
  const creada = await repo.buscarReserva(numero);
  await invalidar({ claves: [`vehiculo:${creada.placa}`], generaciones: ['reservas', 'vehiculos'] });
  reservasCreadas.inc({ tipo_servicio: creada.tipoServicio });
  req.log.info({ numeroReserva: numero, placa: creada.placa, tarifa: creada.tarifaEstimada }, 'Reserva creada');
  res.status(201).location(`${urlBase(req)}/reservas/${numero}`).json(representarReserva(req, creada));
});

// PATCH /api/reservas/RSV-000001  { "estado": "CANCELADA" }
rutasReservas.patch('/:numero', async (req, res) => {
  exigirJson(req);
  const numero = req.params.numero.toUpperCase();
  validarNumero(numero);
  const nuevo = req.body?.estado;
  if (!ESTADOS.includes(nuevo))
    throw new ErrorApi(422, 'Estado inválido', `Uno de: ${ESTADOS.join(', ')}`, { errores: [{ campo: 'estado', mensaje: 'Valor no reconocido' }] });
  const { desde, placa } = await repo.cambiarEstado(numero, nuevo);
  await invalidar({ claves: [`reserva:${numero}`, `vehiculo:${placa}`], generaciones: ['reservas', 'vehiculos'] });
  transicionesEstado.inc({ desde, hacia: nuevo });
  req.log.info({ numeroReserva: numero, desde, hacia: nuevo }, 'Cambio de estado');
  res.json(representarReserva(req, await repo.buscarReserva(numero)));
});
