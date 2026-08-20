import { NextResponse } from 'next/server';
import { obtenerTarifaInterna } from '@/lib/zonas';
import { esNoche } from '@/lib/horario';

const PRECIO_POR_KM: Record<string, number> = {
  moto: 0.30,
  delivery: 0.25,
  encomienda: 0.50,
};

const TARIFA_MINIMA = 1.7;      // mínima general diurna
const FACTOR_NOCTURNO = 1.2;    // +20% en horario nocturno

const SERVICE_LABELS: Record<string, string> = {
  moto: '🚲 Mototaxi',
  delivery: '📦 Delivery',
  encomienda: '📮 Encomienda',
};

const METODO_LABELS: Record<string, string> = {
  movil: 'Pago Móvil',
  efectivo: 'Efectivo (USD)',
  efectivo_bs: 'Efectivo (Bs.)',
};

async function obtenerTasa() {
  try {
    const resp = await fetch('https://dolarflow.com/api/oficial/', {
      next: { revalidate: 3600 },
    });
    const data = await resp.json();
    return { tasa_bs: Number(data.precio), fuente: data.fuente };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const {
    lat_origen,
    lon_origen,
    lat_destino,
    lon_destino,
    tipo_servicio = 'moto',
    nombre = '',
    telefono = '',
    metodo_pago = 'efectivo',
    direccion_origen = '',
    direccion_destino = '',
  } = body;

  if (!lat_origen || !lon_origen || !lat_destino || !lon_destino) {
    return NextResponse.json({ error: 'Faltan coordenadas' }, { status: 400 });
  }

  // GraphHopper
  const GH_KEY = process.env.GRAPHHOPPER_KEY || 'd9b7a161-8575-43c5-9d4f-a89ee501225e';
  let ghData: any;
  try {
    const ghUrl =
      `https://graphhopper.com/api/1/route?` +
      `point=${lat_origen},${lon_origen}&point=${lat_destino},${lon_destino}` +
      `&vehicle=car&locale=es&instructions=false&points_encoded=false&key=${GH_KEY}`;
    const resp = await fetch(ghUrl, { signal: AbortSignal.timeout(10000) });
    ghData = await resp.json();
  } catch {
    return NextResponse.json({ error: 'Error al calcular la ruta' }, { status: 502 });
  }

  const route = ghData?.paths?.[0];
  if (!route) {
    return NextResponse.json({ error: 'No se encontró ruta' }, { status: 502 });
  }

  const distancia_metros: number = route.distance;
  const duracion_segundos: number = route.time / 1000;
  const route_geometry = route.points;

  const distancia_km = Math.round((distancia_metros / 1000) * 100) / 100;
  const duracion_minutos = Math.round(duracion_segundos / 60);

  const precio_km = PRECIO_POR_KM[tipo_servicio] ?? 0.30;
  const tarifaInterna = obtenerTarifaInterna(lat_origen, lon_origen, lat_destino, lon_destino);
  const noche = esNoche();

  let precio_usd = 0;
  let detalle_precio = '';
  if (tarifaInterna) {
    precio_usd = noche ? tarifaInterna.tarifa_interna_noche : tarifaInterna.tarifa_interna;
    detalle_precio = `Tarifa interna ${tarifaInterna.nombre}: $${precio_usd.toFixed(2)}${noche ? ' (nocturna)' : ''}`;
  } else {
    let base = 0.50 + precio_km * distancia_km;
    if (noche) base = base * FACTOR_NOCTURNO;
    precio_usd = Math.round(base * 100) / 100;
    const minima = noche ? TARIFA_MINIMA * FACTOR_NOCTURNO : TARIFA_MINIMA;
    if (precio_usd < minima) precio_usd = Math.round(minima * 100) / 100;
    detalle_precio = `$0.50 base + $${precio_km.toFixed(2)}/km × ${distancia_km} km${noche ? ' (+20% nocturno)' : ''}`;
  }

  const tasaInfo = await obtenerTasa();
  const tasa_bs = tasaInfo?.tasa_bs ?? null;
  const precio_bs = tasa_bs ? Math.round(precio_usd * tasa_bs * 100) / 100 : null;

  const servicio_label = SERVICE_LABELS[tipo_servicio] ?? 'Mototaxi';
  const metodo_label = METODO_LABELS[metodo_pago] ?? 'Efectivo';

  const tiempo_texto =
    duracion_minutos < 60
      ? `${duracion_minutos} min`
      : `${Math.floor(duracion_minutos / 60)}h${duracion_minutos % 60 ? ` ${duracion_minutos % 60}min` : ''}`;

  const lines: string[] = ['🛵 *Moto Alianza - Cotización*'];
  lines.push('─────────────────────');
  if (nombre) lines.push(`Cliente: ${nombre}`);
  if (telefono) lines.push(`Teléfono: ${telefono}`);
  lines.push(`Servicio: ${servicio_label}`);
  if (direccion_origen) lines.push(`Origen: ${direccion_origen}`);
  if (direccion_destino) lines.push(`Destino: ${direccion_destino}`);
  if (tarifaInterna) lines.push(`Tarifa: *Interna ${tarifaInterna.nombre}*${noche ? ' 🌙' : ''}`);
  if (noche && !tarifaInterna) lines.push(`Tarifa: *Nocturna (+20%)* 🌙`);
  lines.push(`Distancia: ${distancia_km} km`);
  lines.push(`Tiempo: ~${tiempo_texto}`);
  lines.push(`Total USD: *$${precio_usd.toFixed(2)}*`);
  if (precio_bs) lines.push(`Total Bs.: *Bs. ${precio_bs.toFixed(2).replace('.', ',')}*`);
  lines.push(`Pago: ${metodo_label}`);
  lines.push('─────────────────────');
  const mapsUrl = `https://www.google.com/maps/dir/${lat_origen},${lon_origen}/${lat_destino},${lon_destino}`;
  lines.push(`📍 Abrir ruta en Google Maps:`);
  lines.push(mapsUrl);
  lines.push('─────────────────────');
  lines.push('¿Confirmas el viaje?');

  return NextResponse.json({
    distancia_km,
    duracion_minutos,
    costo_total: precio_usd,
    precio_usd,
    precio_bs,
    tasa_bs,
    precio_km,
    tipo_servicio: servicio_label,
    detalle_precio,
    zona_interna: tarifaInterna?.nombre ?? null,
    noche,
    whatsapp_text: lines.join('\n'),
    route_geometry,
  });
}
