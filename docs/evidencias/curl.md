# Evidencias con curl

Salidas reales contra el stack local (`docker compose up -d`), generadas el 27-11-2026 10:48. Se muestran solo las cabeceras relevantes; los cuerpos largos se recortan con «…».

## 1. Códigos HTTP

### 200 OK — consulta por número

```bash
$ curl -i -H 'X-API-Version: 1' http://localhost:3000/api/reservas/RSV-000050
```

```http
HTTP/1.1 200 OK
X-Request-Id: 6a36fbd4-c2db-43cc-9168-39ede97bc523
X-API-Version: 1
X-Cache: HIT
Content-Type: application/json; charset=utf-8

{
  "numeroReserva": "RSV-000050",
  "estado": "CONFIRMADA",
  "placa": "GHI789",
  "conductor": "Jhon Fredy Ríos",
  "pasajeroNombre": "Valentina Ospina",
  "pasajeroTelefono": "3001395950",
  "origen": "Universidad de Antioquia, Medellín",
  "destino": "Aeropuerto Olaya Herrera, Medellín",
  "fechaHoraRecogida": "2026-11-28T01:33:00.000Z",
  "numPasajeros": 3,
  "tipoServicio": "ECONOMICO",
  "metodoPago": "NEQUI",
  "tarifaEstimada": 17700,
  "creadaEn": "2026-11-25T15:33:51.261Z",
  "_links": {
    "self": {
      "href": "http://localhost:3000/api/reservas/RSV-000050"
    },
    "vehiculo": {
      "href": "http://localhost:3000/api/vehiculos/GHI789"
    },
    "reservas-del-vehiculo": {
      "href": "http://localhost:3000/api/reservas?placa=GHI789"
    },
    "coleccion": {
      "href": "http://localhost:3000/api/reservas"
    },
    "conductor-en-camino": {
      "href": "http://localhost:3000/api/reservas/RSV-000050",
      "method": "PATCH",
      "type": "application/json",
      "body": {
        "estado": "CONDUCTOR_EN_CAMINO"
      }
    },
    "cancelar": {
      "href": "http://localhost:3000/api/reservas/RSV-000050",
      "method": "PATCH",
      "type": "application/json",
…
```

### 201 Created — nueva reserva (POST)

```bash
$ curl -i -X POST http://localhost:3000/api/reservas -H 'Content-Type: application/json' -H 'X-API-Version: 2' -d '{… placa JKL012, recogida 2027-02-07T10:15:00-05:00 …}'
```

```http
HTTP/1.1 201 Created
X-Request-Id: d59b3391-ee34-4f41-8d9b-80d039ecb85c
X-API-Version: 2
Location: http://localhost:3000/api/reservas/RSV-000186
Content-Type: application/json; charset=utf-8

{
  "numeroReserva": "RSV-000186",
  "estado": {
    "codigo": "PENDIENTE",
    "descripcion": "Reserva recibida, esperando que el conductor la acepte"
  },
  "pasajero": {
    "nombre": "Laura Gómez",
    "documento": "1037654321",
    "telefono": "3001234567",
    "email": null
  },
  "ruta": {
    "origen": {
      "direccion": "Universidad de Antioquia",
      "lat": 6.2677,
      "lng": -75.5688
    },
    "destino": {
      "direccion": "Aeropuerto José María Córdova",
      "lat": 6.1645,
      "lng": -75.4231
    },
    "distanciaKm": 25.71
  },
  "recogida": {
    "fechaHora": "2027-02-07T15:15:00.000Z",
    "numPasajeros": 2
  },
  "servicio": {
    "tipo": "CONFORT",
    "metodoPago": "NEQUI"
  },
  "tarifa": {
    "valor": 68300,
    "moneda": "COP"
  },
  "observaciones": null,
  "auditoria": {
    "creadaEn": "2026-11-27T15:48:10.778Z",
    "actualizadaEn": "2026-11-27T15:48:10.778Z"
  },
  "_embedded": {
    "vehiculo": {
      "placa": "JKL012",
      "marca": "Mazda",
      "modelo": "3 Sedán",
      "anio": 2024,
      "color": "Negro",
      "conductor": {
        "nombre": "Luisa Fernanda Gil",
        "telefono": "3137890123",
        "calificacion": 5
      }
    }
  },
  "_links": {
    "self": {
      "href": "http://localhost:3000/api/reservas/RSV-000186"
    },
…
```

### 400 Bad Request — versión no soportada

```bash
$ curl -i -H 'X-API-Version: 9' http://localhost:3000/api/reservas?placa=ABC123
```

```http
HTTP/1.1 400 Bad Request
X-Request-Id: 5eb6f976-6617-4dd6-9987-b558301ad9ed
Content-Type: application/problem+json; charset=utf-8

{
  "type": "https://httpstatuses.io/400",
  "title": "Versión de API no soportada",
  "status": 400,
  "detail": "La versión '9' no existe. Envíe el header X-API-Version con uno de: 1, 2",
  "instance": "/api/reservas?placa=ABC123",
  "requestId": "5eb6f976-6617-4dd6-9987-b558301ad9ed",
  "versionesSoportadas": [
    "1",
    "2"
  ]
}
```

### 400 Bad Request — placa con formato inválido

```bash
$ curl -i http://localhost:3000/api/reservas?placa=XX
```

```http
HTTP/1.1 400 Bad Request
X-Request-Id: 625b11e9-0a12-4edf-ab64-6f6d351acc38
X-API-Version: 1
Content-Type: application/problem+json; charset=utf-8

{
  "type": "https://httpstatuses.io/400",
  "title": "Parámetros de búsqueda inválidos",
  "status": 400,
  "detail": "Revise los filtros",
  "instance": "/api/reservas?placa=XX",
  "requestId": "625b11e9-0a12-4edf-ab64-6f6d351acc38",
  "errores": [
    {
      "campo": "placa",
      "mensaje": "Formato ABC123"
    }
  ]
}
```

### 404 Not Found — reserva inexistente

```bash
$ curl -i http://localhost:3000/api/reservas/RSV-999999
```

```http
HTTP/1.1 404 Not Found
X-Request-Id: 25d094c0-ea0f-46b9-8ea6-ed9a93d6e737
X-API-Version: 1
X-Cache: MISS
Content-Type: application/problem+json; charset=utf-8

{
  "type": "https://httpstatuses.io/404",
  "title": "Reserva no encontrada",
  "status": 404,
  "detail": "No existe la reserva RSV-999999",
  "instance": "/api/reservas/RSV-999999",
  "requestId": "25d094c0-ea0f-46b9-8ea6-ed9a93d6e737"
}
```

### 409 Conflict — vehículo ya reservado a esa hora

```bash
$ curl -i -X POST http://localhost:3000/api/reservas -H 'Content-Type: application/json' -d '{… mismo cuerpo de arriba: placa JKL012 a las 2027-02-07T10:15:00-05:00 …}'
```

```http
HTTP/1.1 409 Conflict
X-Request-Id: a911b221-dd35-42c3-bd80-0e97ec095cb3
X-API-Version: 1
Content-Type: application/problem+json; charset=utf-8

{
  "type": "https://httpstatuses.io/409",
  "title": "Vehículo no disponible",
  "status": 409,
  "detail": "El vehículo JKL012 ya tiene la reserva RSV-000186 a menos de una hora de esa recogida",
  "instance": "/api/reservas",
  "requestId": "a911b221-dd35-42c3-bd80-0e97ec095cb3",
  "reservaEnConflicto": "RSV-000186"
}
```

### 415 Unsupported Media Type — cuerpo que no es JSON

```bash
$ curl -i -X POST http://localhost:3000/api/reservas -H 'Content-Type: text/plain' -d 'tipoServicio=XL'
```

```http
HTTP/1.1 415 Unsupported Media Type
X-Request-Id: 4b9a6240-bc73-4e05-a7dc-13eaba0ddd00
X-API-Version: 1
Content-Type: application/problem+json; charset=utf-8

{
  "type": "https://httpstatuses.io/415",
  "title": "Tipo de contenido no soportado",
  "status": 415,
  "detail": "Envíe Content-Type: application/json",
  "instance": "/api/reservas",
  "requestId": "4b9a6240-bc73-4e05-a7dc-13eaba0ddd00"
}
```

### 422 Unprocessable Content — validación de campos

```bash
$ curl -i -X POST http://localhost:3000/api/reservas -H 'Content-Type: application/json' -d '{"tipoServicio":"BUS","numPasajeros":12}'
```

```http
HTTP/1.1 422 Unprocessable Entity
X-Request-Id: 7aa40740-4305-4fec-bd48-0c2a0e91ea20
X-API-Version: 1
Content-Type: application/problem+json; charset=utf-8

{
  "type": "https://httpstatuses.io/422",
  "title": "Reserva inválida",
  "status": 422,
  "detail": "Uno o más campos no cumplen las reglas",
  "instance": "/api/reservas",
  "requestId": "7aa40740-4305-4fec-bd48-0c2a0e91ea20",
  "errores": [
    {
      "campo": "tipoServicio",
      "mensaje": "Uno de: ECONOMICO, CONFORT, XL"
    },
    {
      "campo": "metodoPago",
      "mensaje": "Uno de: EFECTIVO, TARJETA, NEQUI, DAVIPLATA"
    },
    {
      "campo": "pasajero",
      "mensaje": "Es obligatorio (nombre, documento, telefono, email)"
    },
    {
      "campo": "origen",
      "mensaje": "Es obligatorio (direccion, lat, lng)"
    },
    {
      "campo": "destino",
      "mensaje": "Es obligatorio (direccion, lat, lng)"
    },
    {
      "campo": "fechaHoraRecogida",
      "mensaje": "Fecha ISO-8601, p. ej. 2026-12-01T08:30:00-05:00"
    },
    {
      "campo": "numPasajeros",
      "mensaje": "Entero entre 1 y 8"
    }
  ]
}
```

## 2. Versionamiento: v1 frente a v2

La misma URL con distinto `X-API-Version`: la v1 es plana y la v2 anida vehículo, pasajero y ruta.

### X-API-Version: 1 (plana)

```bash
$ curl -i -H 'X-API-Version: 1' http://localhost:3000/api/reservas/RSV-000010
```

```http
HTTP/1.1 200 OK
X-Request-Id: b61e29eb-c9b0-4321-9d28-f3950221efa7
X-API-Version: 1
X-Cache: HIT
Content-Type: application/json; charset=utf-8

{
  "numeroReserva": "RSV-000010",
  "estado": "FINALIZADA",
  "placa": "GHI789",
  "conductor": "Jhon Fredy Ríos",
  "pasajeroNombre": "Daniela Castaño",
  "pasajeroTelefono": "3001079190",
  "origen": "Universidad de Antioquia, Medellín",
  "destino": "Aeropuerto José María Córdova, Rionegro",
  "fechaHoraRecogida": "2026-11-19T17:33:00.000Z",
  "numPasajeros": 3,
  "tipoServicio": "ECONOMICO",
  "metodoPago": "NEQUI",
  "tarifaEstimada": 50300,
  "creadaEn": "2026-11-17T17:33:00.000Z",
  "_links": {
    "self": {
      "href": "http://localhost:3000/api/reservas/RSV-000010"
    },
    "vehiculo": {
      "href": "http://localhost:3000/api/vehiculos/GHI789"
    },
    "reservas-del-vehiculo": {
      "href": "http://localhost:3000/api/reservas?placa=GHI789"
    },
    "coleccion": {
      "href": "http://localhost:3000/api/reservas"
    }
  }
}
```

### X-API-Version: 2 (anidada)

```bash
$ curl -i -H 'X-API-Version: 2' http://localhost:3000/api/reservas/RSV-000010
```

```http
HTTP/1.1 200 OK
X-Request-Id: d564e99c-8935-4e15-8fdd-6ee843fb7f0a
X-API-Version: 2
X-Cache: HIT
Content-Type: application/json; charset=utf-8

{
  "numeroReserva": "RSV-000010",
  "estado": {
    "codigo": "FINALIZADA",
    "descripcion": "El viaje terminó"
  },
  "pasajero": {
    "nombre": "Daniela Castaño",
    "documento": "1035112233",
    "telefono": "3001079190",
    "email": "daniela10@correo.com"
  },
  "ruta": {
    "origen": {
      "direccion": "Universidad de Antioquia, Medellín",
      "lat": 6.2677,
      "lng": -75.5688
    },
    "destino": {
      "direccion": "Aeropuerto José María Córdova, Rionegro",
      "lat": 6.1645,
      "lng": -75.4231
    },
    "distanciaKm": 25.71
  },
  "recogida": {
    "fechaHora": "2026-11-19T17:33:00.000Z",
    "numPasajeros": 3
  },
  "servicio": {
    "tipo": "ECONOMICO",
    "metodoPago": "NEQUI"
  },
  "tarifa": {
    "valor": 50300,
    "moneda": "COP"
  },
  "observaciones": null,
  "auditoria": {
    "creadaEn": "2026-11-17T17:33:00.000Z",
    "actualizadaEn": "2026-11-19T17:33:00.000Z"
  },
  "_embedded": {
    "vehiculo": {
      "placa": "GHI789",
      "marca": "Kia",
      "modelo": "Picanto",
      "anio": 2022,
      "color": "Rojo",
      "conductor": {
        "nombre": "Jhon Fredy Ríos",
        "telefono": "3126789012",
        "calificacion": 4.9
      }
    }
  },
  "_links": {
    "self": {
      "href": "http://localhost:3000/api/reservas/RSV-000010"
    },
…
```

## 3. Caché Redis: X-Cache MISS y luego HIT

```bash
$ curl -s -o /dev/null -D - http://localhost:3000/api/reservas/RSV-000014 | grep -i '^x-cache'
X-Cache: MISS
$ curl -s -o /dev/null -D - http://localhost:3000/api/reservas/RSV-000014 | grep -i '^x-cache'
X-Cache: HIT
```

La primera petición va a PostgreSQL y guarda la respuesta 60 s; la segunda sale de Redis.

## 4. Pruebas de integración (`npm test`)

```text
▶ Versionamiento por Custom Request Header
  ✔ sin header usa la versión 1 y la informa (38.294166ms)
  ✔ X-API-Version: 2 devuelve la representación anidada (5.917625ms)
  ✔ una versión desconocida responde 400 con las versiones soportadas (2.465042ms)
  ✔ declara Vary: X-API-Version para cachés intermedias (2.063ms)
✔ Versionamiento por Custom Request Header (49.4785ms)
▶ GET reservas por placa o número
  ✔ por placa devuelve página HAL con enlaces de paginación (4.26425ms)
  ✔ el enlace next lleva a la página 2 conservando el filtro (7.439417ms)
  ✔ acepta la placa en minúsculas y con guion (2.977375ms)
  ✔ por número de reserva (ruta) devuelve el estado (1.653ms)
  ✔ por número de reserva (query) devuelve una colección de un elemento (2.964417ms)
  ✔ 404 si la placa no está registrada (3.089875ms)
  ✔ 404 si la reserva no existe (2.168417ms)
  ✔ 400 si la placa o el número tienen mal formato (2.25175ms)
  ✔ 400 si la paginación es inválida (2.666834ms)
✔ GET reservas por placa o número (29.975333ms)
▶ Caché Redis
  ✔ la segunda lectura sale de la caché (X-Cache: HIT) (10.070375ms)
✔ Caché Redis (10.180667ms)
▶ POST nueva reserva
  ✔ 201 con Location, estado PENDIENTE, tarifa calculada y enlaces de acción (6.994458ms)
  ✔ la reserva creada aparece al consultar su placa (la caché se invalida) (6.515708ms)
  ✔ 409 si el vehículo ya tiene una reserva a menos de una hora (5.801958ms)
  ✔ 422 con la lista de campos inválidos (1.373459ms)
  ✔ 422 si la fecha está en el pasado (1.06125ms)
  ✔ 422 si la placa no existe o no coincide con el tipo de servicio (3.265208ms)
  ✔ 415 si no se envía JSON (1.196834ms)
  ✔ 400 si el JSON está mal formado (1.2775ms)
✔ POST nueva reserva (27.756875ms)
▶ HATEOAS: transiciones de estado guiadas por enlaces
  ✔ sigue los enlaces confirmar → conductor-en-camino → iniciar-viaje → finalizar (14.852875ms)
  ✔ 409 si la transición no está permitida (5.942833ms)
✔ HATEOAS: transiciones de estado guiadas por enlaces (20.916667ms)
▶ Raíz, vehículos y salud
  ✔ la raíz /api anuncia los recursos con enlaces templated (1.084292ms)
  ✔ GET /vehiculos pagina y filtra por tipo (2.341208ms)
  ✔ GET /vehiculos/{placa} 200 y 404 (2.304583ms)
  ✔ /health y /metrics responden (4.608625ms)
✔ Raíz, vehículos y salud (10.513ms)
ℹ tests 28
ℹ suites 6
ℹ pass 28
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 213.356375
```
