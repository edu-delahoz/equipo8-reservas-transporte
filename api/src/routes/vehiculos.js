import { Router } from 'express';
import { generacion, obtenerConCache } from '../lib/cache.js';
import { RE_PLACA, TIPOS_SERVICIO, normalizarPlaca, paginacion } from '../lib/dominio.js';
import { ErrorApi } from '../lib/errores.js';
import { representarColeccion, representarVehiculo } from '../lib/hateoas.js';
import * as repo from '../lib/repositorio.js';

export const rutasVehiculos = Router();

rutasVehiculos.get('/', async (req, res) => {
  const { page, size } = paginacion(req.query);
  const tipoServicio = req.query.tipoServicio?.toUpperCase();
  if (tipoServicio && !TIPOS_SERVICIO.includes(tipoServicio))
    throw new ErrorApi(400, 'Parámetros de búsqueda inválidos', `tipoServicio debe ser uno de: ${TIPOS_SERVICIO.join(', ')}`);
  const gen = await generacion('vehiculos');
  const { valor, hit } = await obtenerConCache(`vehiculos:lista:g${gen}:${tipoServicio ?? '*'}:${page}:${size}`, 'vehiculos', () =>
    repo.listarVehiculos({ tipoServicio, page, size }),
  );
  res.set('X-Cache', hit ? 'HIT' : 'MISS');
  res.json(
    representarColeccion(req, {
      nombre: 'vehiculos',
      ruta: 'vehiculos',
      items: valor.items.map((v) => representarVehiculo(req, v)),
      total: valor.total,
      page,
      size,
      filtros: { tipoServicio },
    }),
  );
});

rutasVehiculos.get('/:placa', async (req, res) => {
  const placa = normalizarPlaca(req.params.placa);
  if (!RE_PLACA.test(placa)) throw new ErrorApi(400, 'Placa inválida', `'${req.params.placa}' no tiene el formato ABC123`);
  const { valor, hit } = await obtenerConCache(`vehiculo:${placa}`, 'vehiculo', () => repo.buscarVehiculo(placa));
  res.set('X-Cache', hit ? 'HIT' : 'MISS');
  if (!valor) throw new ErrorApi(404, 'Vehículo no encontrado', `No hay un vehículo registrado con placa ${placa}`);
  res.json(representarVehiculo(req, valor));
});
