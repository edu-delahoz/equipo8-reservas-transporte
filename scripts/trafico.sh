#!/usr/bin/env bash
# Genera tráfico variado contra la API para poblar los paneles de Grafana:
# consultas por placa y por número (v1 y v2, con aciertos de caché), creación de
# reservas, cambios de estado y errores 4xx (400, 404, 409, 415, 422).
#
# Uso: scripts/trafico.sh [rondas]        (por defecto 20)
#      API=http://otro-host:3000/api scripts/trafico.sh 50
set -euo pipefail

API="${API:-http://localhost:3000/api}"
RONDAS="${1:-20}"
PLACAS=(ABC123 DEF456 GHI789 JKL012 MNO345 PQR678 STU901 VWX234)
SERVICIOS=(ECONOMICO CONFORT XL)
PAGOS=(EFECTIVO TARJETA NEQUI DAVIPLATA)

pedir() { # pedir MÉTODO RUTA VERSIÓN [cuerpo] [content-type] → imprime el código HTTP
  local metodo=$1 ruta=$2 version=$3 cuerpo=${4:-} tipo=${5:-application/json}
  local args=(-s -o /dev/null -w '%{http_code}' -X "$metodo" -H "X-API-Version: $version")
  [[ -n $cuerpo ]] && args+=(-H "Content-Type: $tipo" --data "$cuerpo")
  curl "${args[@]}" "$API$ruta"
}

fecha_futura() { # días desde hoy (1–80) con hora y minuto aleatorios, en hora de Colombia
  local dias=$((RANDOM % 80 + 1)) hora=$((RANDOM % 14 + 6)) minuto=$(((RANDOM % 4) * 15))
  if date -v+1d >/dev/null 2>&1; then
    date -v+"${dias}"d "+%Y-%m-%dT$(printf %02d $hora):$(printf %02d $minuto):00-05:00"
  else
    date -d "+${dias} days" "+%Y-%m-%dT$(printf %02d $hora):$(printf %02d $minuto):00-05:00"
  fi
}

cuerpo_reserva() {
  local servicio=${SERVICIOS[$((RANDOM % 3))]} pago=${PAGOS[$((RANDOM % 4))]}
  cat <<JSON
{"tipoServicio":"$servicio","metodoPago":"$pago","numPasajeros":$((RANDOM % 3 + 1)),
 "pasajero":{"nombre":"Pasajero de prueba $RANDOM","documento":"10$((RANDOM % 90000000 + 10000000))","telefono":"300$((RANDOM % 9000000 + 1000000))"},
 "origen":{"direccion":"Universidad de Antioquia","lat":6.2677,"lng":-75.5688},
 "destino":{"direccion":"Parque Lleras","lat":6.2085,"lng":-75.5670},
 "fechaHoraRecogida":"$(fecha_futura)"}
JSON
}

REGISTRO=$(mktemp)
trap 'rm -f "$REGISTRO"' EXIT
anotar() { echo "$1" >>"$REGISTRO"; }

echo "Tráfico contra $API ($RONDAS rondas)"
for ((i = 1; i <= RONDAS; i++)); do
  placa=${PLACAS[$((RANDOM % ${#PLACAS[@]}))]}
  numero=$(printf 'RSV-%06d' $((RANDOM % 120 + 1)))
  version=$((RANDOM % 2 + 1))

  # Consultas: la segunda vez la misma clave debería salir de Redis (HIT)
  anotar "$(pedir GET "/reservas?placa=$placa&size=5" "$version")"
  anotar "$(pedir GET "/reservas?placa=$placa&size=5" "$version")"
  anotar "$(pedir GET "/reservas/$numero" "$version")"
  anotar "$(pedir GET "/reservas/$numero" "$version")"
  anotar "$(pedir GET "/vehiculos/$placa" "$version")"

  # Alta de reserva y, a veces, un cambio de estado sobre ella
  respuesta=$(curl -s -o /dev/null -D - -w '%{http_code}' -X POST \
    -H "X-API-Version: $version" -H 'Content-Type: application/json' \
    --data "$(cuerpo_reserva)" "$API/reservas")
  anotar "${respuesta: -3}"
  nueva=$(grep -i '^location:' <<<"$respuesta" | grep -oE 'RSV-[0-9]{6}' || true)
  if [[ -n $nueva && $((RANDOM % 2)) -eq 0 ]]; then
    anotar "$(pedir PATCH "/reservas/$nueva" "$version" '{"estado":"CONFIRMADA"}')"
  fi

  # Errores de cliente
  anotar "$(pedir GET "/reservas/RSV-999999" "$version")"                          # 404
  anotar "$(pedir GET "/reservas?placa=$placa" 9)"                                  # 400 versión
  anotar "$(pedir GET "/reservas?placa=XX" "$version")"                             # 400 placa
  anotar "$(pedir POST "/reservas" "$version" 'tipoServicio=XL' 'text/plain')"      # 415
  anotar "$(pedir POST "/reservas" "$version" '{"tipoServicio":"BUS"}')"            # 422
  [[ -n ${nueva:-} ]] && anotar "$(pedir PATCH "/reservas/$nueva" "$version" '{"estado":"FINALIZADA"}')" # 409

  printf '.'
done
echo

echo "Respuestas por código HTTP:"
sort "$REGISTRO" | uniq -c | awk '{ printf "  %s  %d\n", $2, $1 }'
