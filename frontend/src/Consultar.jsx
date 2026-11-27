import { useState } from 'react';
import { llamar, ruta, vistaReserva } from './api.js';
import { Problema, TarjetaReserva, VerJson } from './comunes.jsx';

export default function Consultar({ version, alResponder }) {
  const [modo, setModo] = useState('placa');
  const [valor, setValor] = useState('ABC123');
  const [resp, setResp] = useState(null);
  const [url, setUrl] = useState(null);

  async function ir(destino) {
    const r = await llamar(destino, { version });
    setUrl(destino);
    setResp(r);
    alResponder(r);
  }

  function buscar(e) {
    e.preventDefault();
    const v = valor.trim().toUpperCase();
    if (!v) return;
    ir(modo === 'placa' ? `/api/reservas?placa=${encodeURIComponent(v)}&size=5` : `/api/reservas/${encodeURIComponent(v)}`);
  }

  async function accion(link) {
    const r = await llamar(ruta(link.href), { version, method: link.method, body: link.body });
    alResponder(r);
    if (r.ok) {
      const refresco = await llamar(url, { version });
      setResp(refresco);
    } else setResp(r);
  }

  const d = resp?.datos;
  const lista = d?._embedded?.reservas ?? (d?.numeroReserva ? [d] : null);

  return (
    <section>
      <form className="buscador" onSubmit={buscar}>
        <select value={modo} onChange={(e) => { setModo(e.target.value); setValor(e.target.value === 'placa' ? 'ABC123' : 'RSV-000050'); }}>
          <option value="placa">Placa del vehículo</option>
          <option value="numero">Número de reserva</option>
        </select>
        <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder={modo === 'placa' ? 'ABC123' : 'RSV-000001'} />
        <button type="submit">Consultar</button>
      </form>

      {resp && !resp.ok && <Problema p={d} />}

      {lista && (
        <>
          {d.page && (
            <p className="meta">
              {d.page.totalElements} reservas · página {d.page.number} de {d.page.totalPages}
            </p>
          )}
          {lista.length === 0 && <p className="meta">Este vehículo no tiene reservas.</p>}
          <div className="grilla">
            {lista.map((r) => (
              <TarjetaReserva key={r.numeroReserva} r={vistaReserva(r)} alAccionar={accion} />
            ))}
          </div>
          {d._links && d.page && (
            <div className="paginacion">
              {['first', 'prev', 'next', 'last'].map((rel) => (
                <button key={rel} disabled={!d._links[rel]} onClick={() => ir(ruta(d._links[rel].href))}>
                  {{ first: '« Primera', prev: '‹ Anterior', next: 'Siguiente ›', last: 'Última »' }[rel]}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {resp && <VerJson datos={d} />}
    </section>
  );
}
