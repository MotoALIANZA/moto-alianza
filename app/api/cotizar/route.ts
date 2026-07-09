import { NextResponse } from 'next/server';

const PRECIO_POR_KM: Record<string, number> = {
  moto: 0.30,
  delivery: 0.25,
  encomienda: 0.50,
};

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

  // OSRM
  let osrmData: any;
  try {
    const osrmUrl =
      `http://router.project-osrm.org/route/v1/driving/` +
      `${lon_origen},${lat_origen};${lon_destino},${lat_destino}` +
      `?overview=full&geometries=geojson`;
    const resp = await fetch(osrmUrl, { signal: AbortSignal.timeout(10000) });
    osrmData = await resp.json();
  } catch {
    return NextResponse.json({ error: 'Error al calcular la ruta' }, { status: 502 });
  }

  const route = osrmData?.routes?.[0];
  if (!route) {
    return NextResponse.json({ error: 'No se encontró ruta' }, { status: 502 });
  }

  const distancia_metros: number = route.distance;
  const duracion_segundos: number = route.duration;
  const route_geometry = route.geometry;

  const distancia_km = Math.round((distancia_metros / 1000) * 100) / 100;
  const duracion_minutos = Math.round(duracion_segundos / 60);

  const precio_km = PRECIO_POR_KM[tipo_servicio] ?? 0.30;
  const precio_usd = Math.round((1.0 + precio_km * distancia_km) * 100) / 100;

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
    whatsapp_text: lines.join('\n'),
    route_geometry,
  });
}
