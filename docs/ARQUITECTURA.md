# Arquitectura — API de reservas de transporte (Equipo 8)

Los diagramas siguen el modelo **C4** (contexto y contenedores) y se completan con la vista de **despliegue** en Docker Compose. Están escritos en Mermaid, así que GitHub los dibuja directamente; la imagen [`evidencias/arquitectura.png`](evidencias/arquitectura.png) es la misma vista exportada.

![Arquitectura](evidencias/arquitectura.png)

## 1. Contexto (C4 nivel 1)

Quién usa el sistema y con qué se relaciona.

```mermaid
flowchart LR
  pasajero(["👤 Pasajero / operador<br/><small>Consulta el estado de una reserva y registra nuevas</small>"])
  cliente(["💻 Cliente externo<br/><small>Otra aplicación que consume la API REST</small>"])
  equipo(["🛠️ Equipo de operación<br/><small>Vigila métricas, logs y alertas</small>"])

  sistema["<b>Sistema de reservas de transporte</b><br/><small>Consulta por placa o número, crea reservas,<br/>cambia su estado con HATEOAS</small>"]

  pasajero -- "Usa el frontend (HTTPS/JSON)" --> sistema
  cliente -- "REST + X-API-Version (JSON / HAL)" --> sistema
  equipo -- "Paneles y alertas" --> sistema

  classDef persona fill:#08427b,color:#fff,stroke:#052e56
  classDef sis fill:#1168bd,color:#fff,stroke:#0b4884
  class pasajero,cliente,equipo persona
  class sistema sis
```

## 2. Contenedores (C4 nivel 2)

Las piezas que se despliegan y cómo se hablan.

```mermaid
flowchart TB
  usuario(["👤 Pasajero / operador"])
  cliente(["💻 Cliente externo"])
  ops(["🛠️ Operación"])

  subgraph sistema["Sistema de reservas de transporte"]
    direction TB
    front["<b>Frontend</b><br/><small>React + Vite servido por nginx<br/>Proxy /api y /api-docs</small>"]
    api["<b>API REST</b><br/><small>Node.js 22 + Express<br/>HAL, versionamiento por header,<br/>Problem Details, OpenAPI/Swagger</small>"]
    db[("<b>PostgreSQL 17</b><br/><small>vehiculo, reserva</small>")]
    cache[("<b>Redis 7</b><br/><small>Caché cache-aside<br/>TTL 60 s</small>")]
  end

  subgraph obs["Observabilidad"]
    direction TB
    prom["<b>Prometheus</b><br/><small>Scraping + reglas de alerta</small>"]
    graf["<b>Grafana</b><br/><small>Dashboard provisionado</small>"]
    loki["<b>Loki</b><br/><small>Logs JSON de la API</small>"]
    rexp["redis-exporter"]
    pexp["postgres-exporter"]
  end

  usuario -- "HTTP :8080" --> front
  front -- "/api → proxy_pass" --> api
  cliente -- "HTTP :3000<br/>X-API-Version: 1 | 2" --> api
  api -- "SQL (pg, transacciones)" --> db
  api -- "GET/SET + invalidación" --> cache
  api -- "push de logs (pino-loki)" --> loki
  prom -- "scrape /metrics" --> api
  prom -- "scrape" --> rexp
  prom -- "scrape" --> pexp
  rexp --> cache
  pexp --> db
  graf -- "PromQL" --> prom
  graf -- "LogQL" --> loki
  ops -- "HTTP :3001 / :9090" --> graf

  classDef persona fill:#08427b,color:#fff,stroke:#052e56
  classDef cont fill:#438dd5,color:#fff,stroke:#2e6295
  classDef dato fill:#2b6a8f,color:#fff,stroke:#1d4a64
  classDef obsv fill:#6b7b8c,color:#fff,stroke:#4a5560
  class usuario,cliente,ops persona
  class front,api cont
  class db,cache dato
  class prom,graf,loki,rexp,pexp obsv
```

### Flujo de una consulta (cache-aside)

```mermaid
sequenceDiagram
  autonumber
  participant C as Cliente
  participant A as API
  participant R as Redis
  participant P as PostgreSQL
  C->>A: GET /api/reservas/RSV-000050 (X-API-Version: 2)
  A->>R: GET reserva:RSV-000050
  alt está en caché
    R-->>A: JSON
    A-->>C: 200 + X-Cache: HIT
  else no está
    R-->>A: (nil)
    A->>P: SELECT … FROM reserva JOIN vehiculo
    P-->>A: fila
    A->>R: SET reserva:RSV-000050 EX 60
    A-->>C: 200 + X-Cache: MISS
  end
  Note over A,R: POST y PATCH invalidan la reserva y suben la generación de los listados
```

## 3. Despliegue

Todo corre en un único host con Docker Compose (proyecto `equipo8-reservas`), en una red interna donde los contenedores se resuelven por nombre de servicio.

```mermaid
flowchart TB
  subgraph host["Host Docker (Mac / Linux) — docker compose"]
    direction TB
    subgraph net["Red interna equipo8-reservas_default"]
      direction LR
      f["frontend<br/><small>nginx:1.29-alpine</small><br/><b>8080→80</b>"]
      a["api<br/><small>node:22-alpine</small><br/><b>3000</b>"]
      p[("postgres<br/><small>postgres:17-alpine</small><br/><b>5432</b>")]
      r[("redis<br/><small>redis:7-alpine</small><br/><b>6379</b>")]
      pr["prometheus<br/><small>prom/prometheus:v3.5.0</small><br/><b>9090</b>"]
      g["grafana<br/><small>grafana/grafana:12.1.0</small><br/><b>3001→3000</b>"]
      l["loki<br/><small>grafana/loki:3.5.3</small><br/><b>3100</b>"]
      re["redis-exporter<br/><small>:9121 (interno)</small>"]
      pe["postgres-exporter<br/><small>:9187 (interno)</small>"]
    end
    vol[("volumen pgdata")]
  end

  f --> a
  a --> p
  a --> r
  a --> l
  pr --> a
  pr --> re
  pr --> pe
  re --> r
  pe --> p
  g --> pr
  g --> l
  p --- vol

  classDef app fill:#438dd5,color:#fff,stroke:#2e6295
  classDef dato fill:#2b6a8f,color:#fff,stroke:#1d4a64
  classDef obsv fill:#6b7b8c,color:#fff,stroke:#4a5560
  class f,a app
  class p,r,vol dato
  class pr,g,l,re,pe obsv
```

| Contenedor | Imagen | Puerto publicado | Depende de |
|---|---|---|---|
| `frontend` | build `./frontend` (nginx) | 8080 | api (healthy) |
| `api` | build `./api` (Node 22) | 3000 | postgres, redis (healthy), loki |
| `postgres` | `postgres:17-alpine` | 5432 | — (volumen `pgdata`, `init.sql`) |
| `redis` | `redis:7-alpine` | 6379 | — |
| `prometheus` | `prom/prometheus:v3.5.0` | 9090 | api, exporters |
| `grafana` | `grafana/grafana:12.1.0` | 3001 | prometheus, loki |
| `loki` | `grafana/loki:3.5.3` | 3100 | — |
| `redis-exporter` | `oliver006/redis_exporter:v1.74.0` | — | redis |
| `postgres-exporter` | `postgres-exporter:v0.17.1` | — | postgres |

## Decisiones de arquitectura

- **Monolito modular** en la API (`routes/` → `lib/dominio` → `lib/repositorio`), suficiente para el alcance y fácil de probar de punta a punta.
- **Versionamiento por header** `X-API-Version`: la misma URL entrega la representación plana (v1) o anidada (v2); un valor desconocido devuelve `400`.
- **HATEOAS con HAL**: cada reserva expone en `_links` solo las transiciones permitidas por su estado (confirmar, cancelar, iniciar, finalizar…).
- **Cache-aside en Redis** con invalidación por clave y por generación de listados, visible en `X-Cache`.
- **Observabilidad desde el inicio**: métricas RED en `/metrics`, logs estructurados a Loki con `X-Request-Id` y alertas en Prometheus.
