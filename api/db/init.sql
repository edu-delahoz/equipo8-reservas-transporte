-- Esquema de reservas de transporte (Equipo 8)
CREATE TYPE tipo_servicio AS ENUM ('ECONOMICO', 'CONFORT', 'XL');
CREATE TYPE metodo_pago AS ENUM ('EFECTIVO', 'TARJETA', 'NEQUI', 'DAVIPLATA');
CREATE TYPE estado_reserva AS ENUM ('PENDIENTE', 'CONFIRMADA', 'CONDUCTOR_EN_CAMINO', 'EN_CURSO', 'FINALIZADA', 'CANCELADA');

CREATE TABLE vehiculo (
  placa              VARCHAR(6) PRIMARY KEY CHECK (placa ~ '^[A-Z]{3}[0-9]{3}$'),
  marca              VARCHAR(40)  NOT NULL,
  modelo             VARCHAR(40)  NOT NULL,
  anio               SMALLINT     NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
  color              VARCHAR(30)  NOT NULL,
  tipo_servicio      tipo_servicio NOT NULL,
  capacidad          SMALLINT     NOT NULL CHECK (capacidad BETWEEN 1 AND 8),
  conductor_nombre   VARCHAR(100) NOT NULL,
  conductor_telefono VARCHAR(20)  NOT NULL,
  calificacion       NUMERIC(2,1) NOT NULL DEFAULT 5.0 CHECK (calificacion BETWEEN 1 AND 5),
  activo             BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE SEQUENCE reserva_numero_seq;

CREATE TABLE reserva (
  numero_reserva      VARCHAR(10) PRIMARY KEY DEFAULT ('RSV-' || lpad(nextval('reserva_numero_seq')::text, 6, '0')),
  placa               VARCHAR(6)  NOT NULL REFERENCES vehiculo (placa),
  pasajero_nombre     VARCHAR(100) NOT NULL,
  pasajero_documento  VARCHAR(12)  NOT NULL,
  pasajero_telefono   VARCHAR(16)  NOT NULL,
  pasajero_email      VARCHAR(120),
  origen_direccion    VARCHAR(200) NOT NULL,
  origen_lat          NUMERIC(9,6) NOT NULL,
  origen_lng          NUMERIC(9,6) NOT NULL,
  destino_direccion   VARCHAR(200) NOT NULL,
  destino_lat         NUMERIC(9,6) NOT NULL,
  destino_lng         NUMERIC(9,6) NOT NULL,
  distancia_km        NUMERIC(6,2) NOT NULL,
  fecha_hora_recogida TIMESTAMPTZ  NOT NULL,
  num_pasajeros       SMALLINT     NOT NULL CHECK (num_pasajeros BETWEEN 1 AND 8),
  tipo_servicio       tipo_servicio NOT NULL,
  metodo_pago         metodo_pago  NOT NULL,
  tarifa_estimada     NUMERIC(10,0) NOT NULL,
  estado              estado_reserva NOT NULL DEFAULT 'PENDIENTE',
  observaciones       VARCHAR(300),
  creada_en           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actualizada_en      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_reserva_placa_fecha ON reserva (placa, fecha_hora_recogida DESC);
CREATE INDEX idx_reserva_estado ON reserva (estado);

-- Datos de ejemplo -----------------------------------------------------------
INSERT INTO vehiculo (placa, marca, modelo, anio, color, tipo_servicio, capacidad, conductor_nombre, conductor_telefono, calificacion) VALUES
  ('ABC123', 'Chevrolet', 'Onix',      2023, 'Blanco', 'ECONOMICO', 4, 'Carlos Restrepo',  '3104567890', 4.8),
  ('DEF456', 'Renault',   'Logan',     2021, 'Gris',   'ECONOMICO', 4, 'Ana María Zapata', '3115678901', 4.6),
  ('GHI789', 'Kia',       'Picanto',   2022, 'Rojo',   'ECONOMICO', 4, 'Jhon Fredy Ríos',  '3126789012', 4.9),
  ('JKL012', 'Mazda',     '3 Sedán',   2024, 'Negro',  'CONFORT',   4, 'Luisa Fernanda Gil','3137890123', 5.0),
  ('MNO345', 'Toyota',    'Corolla',   2023, 'Plata',  'CONFORT',   4, 'Andrés Cardona',   '3148901234', 4.7),
  ('PQR678', 'Hyundai',   'Tucson',    2024, 'Azul',   'CONFORT',   4, 'Sandra Milena Toro','3159012345', 4.5),
  ('STU901', 'Toyota',    'Hiace',     2022, 'Blanco', 'XL',        8, 'Mauricio Arango',  '3160123456', 4.8),
  ('VWX234', 'Kia',       'Carnival',  2023, 'Gris',   'XL',        7, 'Paola Andrea Mejía','3171234567', 4.9);

WITH lugar (id, nombre, lat, lng) AS (VALUES
  (1, 'Universidad de Antioquia, Medellín',         6.267700, -75.568800),
  (2, 'Parque Lleras, El Poblado',                  6.208500, -75.567000),
  (3, 'Aeropuerto José María Córdova, Rionegro',    6.164500, -75.423100),
  (4, 'Centro Comercial Santafé, Medellín',         6.196400, -75.573800),
  (5, 'Estación Parque Berrío, Medellín',           6.250600, -75.568200),
  (6, 'Pueblito Paisa, Cerro Nutibara',             6.235900, -75.578900),
  (7, 'Aeropuerto Olaya Herrera, Medellín',         6.219900, -75.590600),
  (8, 'Parque Explora, Medellín',                   6.270800, -75.565500),
  (9, 'Centro Comercial Viva Envigado',             6.176100, -75.591900),
  (10,'Terminal del Norte, Medellín',               6.278900, -75.570500)
),
nombres (i, nombre, doc) AS (VALUES
  (0,'Laura Gómez','1037654321'), (1,'Santiago Pérez','1017223344'), (2,'Valentina Ospina','1036998877'),
  (3,'Mateo Londoño','1001234567'), (4,'Camila Vélez','1152446688'), (5,'Juan José Muñoz','71234567'),
  (6,'Isabella Montoya','1039876543'), (7,'Samuel Henao','1020304050'), (8,'Mariana Agudelo','43567890'),
  (9,'Sebastián Correa','1128445566'), (10,'Daniela Castaño','1035112233'), (11,'Tomás Echeverri','98765432')
),
base AS (
  SELECT g,
         v.placa, v.tipo_servicio, v.capacidad,
         o.nombre AS o_dir, o.lat AS o_lat, o.lng AS o_lng,
         d.nombre AS d_dir, d.lat AS d_lat, d.lng AS d_lng,
         n.nombre AS p_nombre, n.doc AS p_doc,
         date_trunc('minute', now()) + (g - 48) * interval '5 hours' AS fecha
  FROM generate_series(1, 60) AS g
  JOIN LATERAL (SELECT * FROM vehiculo ORDER BY placa OFFSET (g % 8) LIMIT 1) v ON true
  JOIN lugar o ON o.id = 1 + g % 10
  JOIN lugar d ON d.id = 1 + ((g % 10) + 1 + g % 9) % 10
  JOIN nombres n ON n.i = g % 12
),
calc AS (
  SELECT *, round((6371 * 2 * asin(sqrt(sin(radians(d_lat - o_lat) / 2) ^ 2
           + cos(radians(o_lat)) * cos(radians(d_lat)) * sin(radians(d_lng - o_lng) / 2) ^ 2)) * 1.3)::numeric, 2) AS km
  FROM base
)
INSERT INTO reserva (placa, pasajero_nombre, pasajero_documento, pasajero_telefono, pasajero_email,
  origen_direccion, origen_lat, origen_lng, destino_direccion, destino_lat, destino_lng, distancia_km,
  fecha_hora_recogida, num_pasajeros, tipo_servicio, metodo_pago, tarifa_estimada, estado, creada_en, actualizada_en)
SELECT placa, p_nombre, p_doc, '300' || lpad((1000000 + g * 7919)::text, 7, '0'),
       lower(replace(split_part(p_nombre, ' ', 1), 'é', 'e')) || g || '@correo.com',
       o_dir, o_lat, o_lng, d_dir, d_lat, d_lng, km,
       fecha, 1 + g % least(capacidad, 4), tipo_servicio,
       (ARRAY['EFECTIVO','TARJETA','NEQUI','DAVIPLATA']::metodo_pago[])[1 + g % 4],
       greatest(7000, round((4000 + km * CASE tipo_servicio WHEN 'ECONOMICO' THEN 1800 WHEN 'CONFORT' THEN 2500 ELSE 3200 END) / 100) * 100),
       CASE
         WHEN g % 7 = 0 THEN 'CANCELADA'
         WHEN g <= 46 THEN 'FINALIZADA'
         WHEN g = 47 THEN 'EN_CURSO'
         WHEN g = 48 THEN 'CONDUCTOR_EN_CAMINO'
         WHEN g <= 54 THEN 'CONFIRMADA'
         ELSE 'PENDIENTE'
       END::estado_reserva,
       least(fecha, now()) - interval '2 days', least(fecha, now())
FROM calc ORDER BY g;
