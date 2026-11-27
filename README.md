# API de Reservas de Transporte (tipo Uber) — Equipo 8

Servicio web RESTful para **consultar el estado** de una reserva de transporte (por placa del vehículo o por número de reserva) y **registrar nuevas reservas**. Incluye frontend en React.

| Requisito | Cómo se cumple |
|---|---|
| GET por placa o número | `GET /api/reservas?placa=ABC123` · `GET /api/reservas/RSV-000001` |
| POST nueva reserva | `POST /api/reservas` (asigna vehículo si no se envía placa, calcula distancia y tarifa) |
| Base de datos | PostgreSQL 17 — entidades `vehiculo` y `reserva` |
| OpenAPI / Swagger | `http://localhost:3000/api-docs` |
| JSON | Todas las respuestas; errores en `application/problem+json` (RFC 9457) |
| Versionamiento por Custom Request Header | `X-API-Version: 1` (plana) o `2` (anidada); otra → `400` |
| HATEOAS | Formato HAL (`_links`, `_embedded`); las acciones permitidas dependen del estado |
| Códigos HTTP | 200, 201, 400, 404, 409, 413, 415, 422, 500, 503 |
| Docker | `docker-compose.yml` con 9 contenedores |
| Observabilidad | Prometheus + Grafana (dashboard provisionado) + Loki (logs) + alertas + exporters de Redis y PostgreSQL |
| Caché | Redis (cache-aside, header `X-Cache: HIT/MISS`) |
| Paginación | `page`, `size` y enlaces `first/prev/next/last` |
| Frontend | React + Vite servido por nginx |

## Cómo ejecutarlo

```bash
docker compose up -d --build
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:8080 |
| API | http://localhost:3000/api |
| Swagger | http://localhost:3000/api-docs |
| Grafana (admin/admin) | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

## Ejemplos

```bash
# Consultar por placa (versión 2, página 1 de 5 elementos)
curl -H "X-API-Version: 2" "http://localhost:3000/api/reservas?placa=ABC123&size=5"

# Consultar por número de reserva
curl -H "X-API-Version: 1" http://localhost:3000/api/reservas/RSV-000050

# Crear reserva
curl -X POST http://localhost:3000/api/reservas \
  -H "Content-Type: application/json" -H "X-API-Version: 2" \
  -d '{"tipoServicio":"ECONOMICO","metodoPago":"TARJETA",
       "pasajero":{"nombre":"Laura Gómez","documento":"1037654321","telefono":"3001234567"},
       "origen":{"direccion":"Universidad de Antioquia","lat":6.2677,"lng":-75.5688},
       "destino":{"direccion":"Aeropuerto José María Córdova","lat":6.1645,"lng":-75.4231},
       "fechaHoraRecogida":"2026-12-15T08:30:00-05:00","numPasajeros":2}'
```

## Estructura

```
api/            API Node.js + Express (src/, openapi.yaml, db/init.sql)
frontend/       React + Vite + nginx
observability/  Prometheus, alertas, Grafana, Loki
```

## Equipo 8

[@edu-delahoz](https://github.com/edu-delahoz) · [@IvanVelezQu](https://github.com/IvanVelezQu) · [@jorge-ruizf](https://github.com/jorge-ruizf) · [@c4rlosaucu](https://github.com/c4rlosaucu) · [@Alexa0723](https://github.com/Alexa0723)
