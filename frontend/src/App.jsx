import { useState } from 'react';
import Consultar from './Consultar.jsx';
import NuevaReserva from './NuevaReserva.jsx';

export default function App() {
  const [pestana, setPestana] = useState('consultar');
  const [version, setVersion] = useState('2');
  const [ultima, setUltima] = useState(null);

  return (
    <div className="app">
      <header className="cabecera">
        <div>
          <h1>🚕 Reservas de Transporte</h1>
          <p className="sub">Equipo 8 · API RESTful con HATEOAS, versionamiento por header y caché Redis</p>
        </div>
        <label className="version">
          X-API-Version
          <select value={version} onChange={(e) => setVersion(e.target.value)}>
            <option value="1">1 (plana)</option>
            <option value="2">2 (anidada)</option>
          </select>
        </label>
      </header>

      <nav className="pestanas">
        <button className={pestana === 'consultar' ? 'activa' : ''} onClick={() => setPestana('consultar')}>Consultar reserva</button>
        <button className={pestana === 'nueva' ? 'activa' : ''} onClick={() => setPestana('nueva')}>Nueva reserva</button>
        <span className="enlaces">
          <a href="/api-docs" target="_blank" rel="noreferrer">Swagger</a>
          <a href="http://localhost:3001" target="_blank" rel="noreferrer">Grafana</a>
          <a href="http://localhost:9090" target="_blank" rel="noreferrer">Prometheus</a>
        </span>
      </nav>

      {ultima && (
        <div className={`barra-estado ${ultima.ok ? 'bien' : 'mal'}`}>
          <strong>HTTP {ultima.status}</strong>
          <span>X-API-Version: {ultima.headers.version ?? '—'}</span>
          {ultima.headers.cache && <span>X-Cache: <b>{ultima.headers.cache}</b></span>}
          <span>{ultima.ms} ms</span>
          {ultima.headers.location && <span>Location: {ultima.headers.location}</span>}
        </div>
      )}

      <main>
        {pestana === 'consultar' ? (
          <Consultar version={version} alResponder={setUltima} />
        ) : (
          <NuevaReserva version={version} alResponder={setUltima} />
        )}
      </main>
    </div>
  );
}
