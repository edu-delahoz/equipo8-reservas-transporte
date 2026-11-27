const pesos = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const fecha = (f) => new Date(f).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export function TarjetaReserva({ r, alAccionar }) {
  const acciones = Object.entries(r.links).filter(([, l]) => l.method === 'PATCH');
  return (
    <article className="tarjeta">
      <div className="fila">
        <strong>{r.numero}</strong>
        <span className={`estado e-${r.estado}`}>{r.estado.replaceAll('_', ' ')}</span>
      </div>
      {r.descripcion && <p className="desc">{r.descripcion}</p>}
      <dl>
        <dt>Vehículo</dt><dd>{r.placa} · {r.tipo}</dd>
        <dt>Conductor</dt><dd>{r.conductor}</dd>
        <dt>Pasajero</dt><dd>{r.pasajero} ({r.pasajeros})</dd>
        <dt>Ruta</dt><dd>{r.origen} → {r.destino}{r.km ? ` · ${r.km} km` : ''}</dd>
        <dt>Recogida</dt><dd>{fecha(r.fecha)}</dd>
        <dt>Tarifa</dt><dd>{pesos(r.tarifa)}</dd>
      </dl>
      {acciones.length > 0 && (
        <div className="acciones">
          <small>Acciones (HATEOAS):</small>
          {acciones.map(([rel, l]) => (
            <button key={rel} className={rel === 'cancelar' ? 'peligro' : ''} onClick={() => alAccionar(l)}>
              {rel}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

export function Problema({ p }) {
  if (!p) return null;
  return (
    <div className="problema">
      <strong>{p.status} · {p.title}</strong>
      <p>{p.detail}</p>
      {p.errores && (
        <ul>
          {p.errores.map((e) => <li key={e.campo}><code>{e.campo}</code>: {e.mensaje}</li>)}
        </ul>
      )}
    </div>
  );
}

export function VerJson({ datos }) {
  return (
    <details className="json">
      <summary>Ver respuesta JSON (con _links)</summary>
      <pre>{JSON.stringify(datos, null, 2)}</pre>
    </details>
  );
}
