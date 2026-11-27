import { pool } from './db.js';
import { ErrorApi } from './errores.js';
import { ESTADOS_ACTIVOS, TRANSICIONES } from './dominio.js';

const num = (v) => (v === null ? null : Number(v));

const SELECT_RESERVA = `
  SELECT r.*, v.marca, v.modelo, v.color, v.anio, v.conductor_nombre, v.conductor_telefono, v.calificacion
  FROM reserva r JOIN vehiculo v ON v.placa = r.placa`;

export function filaAReserva(f) {
  return {
    numeroReserva: f.numero_reserva,
    estado: f.estado,
    placa: f.placa,
    vehiculo: {
      placa: f.placa,
      marca: f.marca,
      modelo: f.modelo,
      anio: f.anio,
      color: f.color,
      conductor: { nombre: f.conductor_nombre, telefono: f.conductor_telefono, calificacion: num(f.calificacion) },
    },
    pasajero: { nombre: f.pasajero_nombre, documento: f.pasajero_documento, telefono: f.pasajero_telefono, email: f.pasajero_email },
    origen: { direccion: f.origen_direccion, lat: num(f.origen_lat), lng: num(f.origen_lng) },
    destino: { direccion: f.destino_direccion, lat: num(f.destino_lat), lng: num(f.destino_lng) },
    distanciaKm: num(f.distancia_km),
    fechaHoraRecogida: f.fecha_hora_recogida,
    numPasajeros: f.num_pasajeros,
    tipoServicio: f.tipo_servicio,
    metodoPago: f.metodo_pago,
    tarifaEstimada: num(f.tarifa_estimada),
    observaciones: f.observaciones,
    creadaEn: f.creada_en,
    actualizadaEn: f.actualizada_en,
  };
}

export function filaAVehiculo(f) {
  return {
    placa: f.placa,
    marca: f.marca,
    modelo: f.modelo,
    anio: f.anio,
    color: f.color,
    tipoServicio: f.tipo_servicio,
    capacidad: f.capacidad,
    activo: f.activo,
    conductor: { nombre: f.conductor_nombre, telefono: f.conductor_telefono, calificacion: num(f.calificacion) },
    reservasActivas: f.reservas_activas ?? 0,
  };
}

export async function buscarReserva(numero) {
  const { rows } = await pool.query(`${SELECT_RESERVA} WHERE r.numero_reserva = $1`, [numero]);
  return rows[0] ? filaAReserva(rows[0]) : null;
}

export async function listarReservas({ placa, numero, estado, page, size }) {
  const cond = [];
  const params = [];
  if (placa) cond.push(`r.placa = $${params.push(placa)}`);
  if (numero) cond.push(`r.numero_reserva = $${params.push(numero)}`);
  if (estado) cond.push(`r.estado = $${params.push(estado)}`);
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const total = (await pool.query(`SELECT count(*)::int AS n FROM reserva r ${where}`, params)).rows[0].n;
  const { rows } = await pool.query(
    `${SELECT_RESERVA} ${where} ORDER BY r.fecha_hora_recogida DESC, r.numero_reserva DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, size, (page - 1) * size],
  );
  let vehiculoExiste = true;
  if (placa && total === 0) vehiculoExiste = (await pool.query('SELECT 1 FROM vehiculo WHERE placa = $1', [placa])).rowCount > 0;
  return { items: rows.map(filaAReserva), total, vehiculoExiste };
}

const SELECT_VEHICULO = `
  SELECT v.*, (SELECT count(*)::int FROM reserva r WHERE r.placa = v.placa AND r.estado = ANY($1)) AS reservas_activas
  FROM vehiculo v`;

export async function buscarVehiculo(placa) {
  const { rows } = await pool.query(`${SELECT_VEHICULO} WHERE v.placa = $2`, [ESTADOS_ACTIVOS, placa]);
  return rows[0] ? filaAVehiculo(rows[0]) : null;
}

export async function listarVehiculos({ tipoServicio, page, size }) {
  const params = [ESTADOS_ACTIVOS];
  const where = tipoServicio ? `WHERE v.tipo_servicio = $${params.push(tipoServicio)}` : '';
  const total = (await pool.query(`SELECT count(*)::int AS n FROM vehiculo v ${tipoServicio ? 'WHERE v.tipo_servicio = $1' : ''}`, tipoServicio ? [tipoServicio] : [])).rows[0].n;
  const { rows } = await pool.query(`${SELECT_VEHICULO} ${where} ORDER BY v.placa LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [
    ...params,
    size,
    (page - 1) * size,
  ]);
  return { items: rows.map(filaAVehiculo), total };
}

/**
 * Crea la reserva en una transacción. Si no viene placa, asigna un vehículo disponible
 * del tipo pedido. Bloquea la fila del vehículo para evitar dos reservas simultáneas.
 */
export async function crearReserva(r) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const ventana = `r.estado = ANY($2) AND abs(extract(epoch FROM r.fecha_hora_recogida - $3::timestamptz)) < 3600`;
    let vehiculo;
    if (r.placa) {
      vehiculo = (await c.query('SELECT * FROM vehiculo WHERE placa = $1 FOR UPDATE', [r.placa])).rows[0];
      if (!vehiculo) throw new ErrorApi(422, 'Reserva inválida', `No existe un vehículo con placa ${r.placa}`, { errores: [{ campo: 'placa', mensaje: 'Vehículo no registrado' }] });
      if (vehiculo.tipo_servicio !== r.tipoServicio)
        throw new ErrorApi(422, 'Reserva inválida', `El vehículo ${r.placa} presta servicio ${vehiculo.tipo_servicio}, no ${r.tipoServicio}`, { errores: [{ campo: 'tipoServicio', mensaje: 'No coincide con el vehículo' }] });
      if (vehiculo.capacidad < r.numPasajeros)
        throw new ErrorApi(422, 'Reserva inválida', `El vehículo admite ${vehiculo.capacidad} pasajeros`, { errores: [{ campo: 'numPasajeros', mensaje: 'Supera la capacidad del vehículo' }] });
      if (!vehiculo.activo) throw new ErrorApi(409, 'Vehículo no disponible', `El vehículo ${r.placa} está inactivo`);
      const choque = await c.query(`SELECT numero_reserva FROM reserva r WHERE r.placa = $1 AND ${ventana} LIMIT 1`, [r.placa, ESTADOS_ACTIVOS, r.fechaHoraRecogida]);
      if (choque.rowCount)
        throw new ErrorApi(409, 'Vehículo no disponible', `El vehículo ${r.placa} ya tiene la reserva ${choque.rows[0].numero_reserva} a menos de una hora de esa recogida`, {
          reservaEnConflicto: choque.rows[0].numero_reserva,
        });
    } else {
      vehiculo = (
        await c.query(
          `SELECT v.* FROM vehiculo v
           WHERE v.activo AND v.tipo_servicio = $1 AND v.capacidad >= $4
             AND NOT EXISTS (SELECT 1 FROM reserva r WHERE r.placa = v.placa AND ${ventana})
           ORDER BY v.calificacion DESC, v.placa LIMIT 1 FOR UPDATE SKIP LOCKED`,
          [r.tipoServicio, ESTADOS_ACTIVOS, r.fechaHoraRecogida, r.numPasajeros],
        )
      ).rows[0];
      if (!vehiculo) throw new ErrorApi(409, 'Sin vehículos disponibles', `No hay vehículos ${r.tipoServicio} libres para esa hora`);
    }
    const { rows } = await c.query(
      `INSERT INTO reserva (placa, pasajero_nombre, pasajero_documento, pasajero_telefono, pasajero_email,
         origen_direccion, origen_lat, origen_lng, destino_direccion, destino_lat, destino_lng, distancia_km,
         fecha_hora_recogida, num_pasajeros, tipo_servicio, metodo_pago, tarifa_estimada, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING numero_reserva`,
      [
        vehiculo.placa, r.pasajero.nombre, r.pasajero.documento, r.pasajero.telefono, r.pasajero.email,
        r.origen.direccion, r.origen.lat, r.origen.lng, r.destino.direccion, r.destino.lat, r.destino.lng, r.distanciaKm,
        r.fechaHoraRecogida, r.numPasajeros, r.tipoServicio, r.metodoPago, r.tarifaEstimada, r.observaciones,
      ],
    );
    await c.query('COMMIT');
    return rows[0].numero_reserva;
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    c.release();
  }
}

export async function cambiarEstado(numero, nuevo) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const actual = (await c.query('SELECT estado, placa FROM reserva WHERE numero_reserva = $1 FOR UPDATE', [numero])).rows[0];
    if (!actual) throw new ErrorApi(404, 'Reserva no encontrada', `No existe la reserva ${numero}`);
    const permitidas = Object.keys(TRANSICIONES[actual.estado]);
    if (!permitidas.includes(nuevo))
      throw new ErrorApi(409, 'Transición de estado no permitida', `Una reserva ${actual.estado} no puede pasar a ${nuevo}`, {
        estadoActual: actual.estado,
        transicionesPermitidas: permitidas,
      });
    await c.query('UPDATE reserva SET estado = $2, actualizada_en = now() WHERE numero_reserva = $1', [numero, nuevo]);
    await c.query('COMMIT');
    return { desde: actual.estado, placa: actual.placa };
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    c.release();
  }
}
