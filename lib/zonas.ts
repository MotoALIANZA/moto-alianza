// Poligones de zonas internas tomados de OpenStreetMap (Overpass API, 2026-08-19).
// - La Isabelica: casco convexo de los edificios etiquetados "La Isabelica" en Valencia.
// - Ciudad Alianza: limite oficial de la "Parroquia Ciudad Alianza" (relacion OSM 10832854).
// Orden de cada vertice: [lon, lat].

export type Zona = {
  id: string;
  nombre: string;
  tarifa_interna: number;
  tarifa_interna_noche: number;
  poligonos: [number, number][][];
};

export const ZONAS: Zona[] = [
  {
    id: 'la_isabelica',
    nombre: 'La Isabelica',
    tarifa_interna: 1.9,
    tarifa_interna_noche: 2.5,
    poligonos: [[
      [-67.996857, 10.159758],
      [-67.996857, 10.164321],
      [-67.990849, 10.169052],
      [-67.979176, 10.170910],
      [-67.967331, 10.170403],
      [-67.963039, 10.167024],
      [-67.959606, 10.160096],
      [-67.959263, 10.156886],
      [-67.965271, 10.155027],
      [-67.980892, 10.158238],
      [-67.988789, 10.158914],
      [-67.996342, 10.159252],
    ]],
  },
  {
    id: 'ciudad_alianza',
    nombre: 'Ciudad Alianza',
    tarifa_interna: 1.7,
    tarifa_interna_noche: 2,
    poligonos: [[
      [-67.909309, 10.206560],
      [-67.901070, 10.214162],
      [-67.893173, 10.216189],
      [-67.891457, 10.211966],
      [-67.889397, 10.204870],
      [-67.890942, 10.201491],
      [-67.889740, 10.193889],
      [-67.889225, 10.189158],
      [-67.894203, 10.186961],
      [-67.903301, 10.194057],
      [-67.907593, 10.202505],
      [-67.909138, 10.206729],
    ]],
  },
];

function pointInPolygon(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function puntoEnZona(lat: number, lng: number): Zona | null {
  for (const z of ZONAS) {
    for (const p of z.poligonos) {
      if (pointInPolygon(lng, lat, p)) return z;
    }
  }
  return null;
}

// Si origen y destino estan dentro de la misma zona interna,
// se aplica la tarifa plana de la zona.
export function obtenerTarifaInterna(latO: number, lngO: number, latD: number, lngD: number): Zona | null {
  const zo = puntoEnZona(latO, lngO);
  const zd = puntoEnZona(latD, lngD);
  if (zo && zd && zo.id === zd.id) return zo;
  return null;
}


