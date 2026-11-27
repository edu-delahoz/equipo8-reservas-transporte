import { useEffect, useState } from 'react';
import { LUGARES, llamar, vistaReserva } from './api.js';
import { Problema, TarjetaReserva, VerJson } from './comunes.jsx';

const enUnaHora = () => {
  const d = new Date(Date.now() + 2 * 3600_000);
  d.setMinutes(0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export default function NuevaReserva({ version, alResponder }) {
  const [f, setF] = useState({
    nombre: 'Laura Gómez', documento: '1037654321', telefono: '3001234567', email: 'laura@correo.com',
    origen: 0, destino: 2, fecha: enUnaHora(), numPasajeros: 2, tipoServicio: 'ECONOMICO', metodoPago: 'TARJETA', placa: '', observaciones: '',
  });
  const [vehiculos, setVehiculos] = useState([]);
  const [resp, setResp] = useState(null);
  const cambiar = (campo) => (e) => setF({ ...f, [campo]: e.target.value });

  useEffect(() => {
    llamar(`/api/vehiculos?tipoServicio=${f.tipoServicio}&size=50`, { version: '2' }).then((r) => setVehiculos(r.datos?._embedded?.vehiculos ?? []));
  }, [f.tipoServicio]);

  async function enviar(e) {
    e.preventDefault();
    const o = LUGARES[f.origen];
    const d = LUGARES[f.destino];
    const cuerpo = {
      tipoServicio: f.tipoServicio,
      metodoPago: f.metodoPago,
      pasajero: { nombre: f.nombre, documento: f.documento, telefono: f.telefono, ...(f.email ? { email: f.email } : {}) },
      origen: { direccion: o.nombre, lat: o.lat, lng: o.lng },
      destino: { direccion: d.nombre, lat: d.lat, lng: d.lng },
      fechaHoraRecogida: new Date(f.fecha).toISOString(),
      numPasajeros: Number(f.numPasajeros),
      ...(f.placa ? { placa: f.placa } : {}),
      ...(f.observaciones ? { observaciones: f.observaciones } : {}),
    };
    const r = await llamar('/api/reservas', { version, method: 'POST', body: cuerpo });
    setResp(r);
    alResponder(r);
  }

  return (
    <section className="dos-columnas">
      <form className="formulario" onSubmit={enviar}>
        <fieldset>
          <legend>Pasajero</legend>
          <label>Nombre<input value={f.nombre} onChange={cambiar('nombre')} /></label>
          <label>Documento<input value={f.documento} onChange={cambiar('documento')} /></label>
          <label>Teléfono<input value={f.telefono} onChange={cambiar('telefono')} /></label>
          <label>Correo<input value={f.email} onChange={cambiar('email')} /></label>
        </fieldset>
        <fieldset>
          <legend>Viaje</legend>
          <label>Origen
            <select value={f.origen} onChange={cambiar('origen')}>{LUGARES.map((l, i) => <option key={i} value={i}>{l.nombre}</option>)}</select>
          </label>
          <label>Destino
            <select value={f.destino} onChange={cambiar('destino')}>{LUGARES.map((l, i) => <option key={i} value={i}>{l.nombre}</option>)}</select>
          </label>
          <label>Fecha y hora de recogida<input type="datetime-local" value={f.fecha} onChange={cambiar('fecha')} /></label>
          <label>Pasajeros<input type="number" min="1" max="8" value={f.numPasajeros} onChange={cambiar('numPasajeros')} /></label>
        </fieldset>
        <fieldset>
          <legend>Servicio</legend>
          <label>Tipo
            <select value={f.tipoServicio} onChange={(e) => setF({ ...f, tipoServicio: e.target.value, placa: '' })}>
              <option>ECONOMICO</option><option>CONFORT</option><option>XL</option>
            </select>
          </label>
          <label>Vehículo
            <select value={f.placa} onChange={cambiar('placa')}>
              <option value="">Asignar automáticamente</option>
              {vehiculos.map((v) => <option key={v.placa} value={v.placa}>{v.placa} · {v.marca} {v.modelo} ({v.capacidad} pax)</option>)}
            </select>
          </label>
          <label>Pago
            <select value={f.metodoPago} onChange={cambiar('metodoPago')}>
              <option>EFECTIVO</option><option>TARJETA</option><option>NEQUI</option><option>DAVIPLATA</option>
            </select>
          </label>
          <label>Observaciones<input value={f.observaciones} onChange={cambiar('observaciones')} maxLength={300} /></label>
        </fieldset>
        <button type="submit">Crear reserva (POST)</button>
      </form>

      <div>
        {resp?.ok && (
          <>
            <p className="exito">✅ Reserva creada — HTTP {resp.status}</p>
            <TarjetaReserva r={vistaReserva(resp.datos)} alAccionar={() => {}} />
          </>
        )}
        {resp && !resp.ok && <Problema p={resp.datos} />}
        {resp && <VerJson datos={resp.datos} />}
      </div>
    </section>
  );
}
