// Hora oficial de Venezuela (America/Caracas, UTC-4, sin horario de verano).
// Tarifa nocturna: desde las 8:30 PM hasta las 6:00 AM.

export const HORA_INICIO_NOCTURNO = 20.5; // 8:30 PM
export const HORA_FIN_NOCTURNO = 6;       // 6:00 AM

export function fechaCaracas(fecha: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(fecha);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '0';
  return new Date(
    Date.UTC(
      Number(get('year')),
      Number(get('month')) - 1,
      Number(get('day')),
      Number(get('hour')) % 24,
      Number(get('minute')),
      Number(get('second'))
    )
  );
}

// Hora decimal (ej: 20:30 -> 20.5) en hora de Venezuela.
export function horaCaracas(fecha: Date = new Date()): number {
  const c = fechaCaracas(fecha);
  return c.getUTCHours() + c.getUTCMinutes() / 60 + c.getUTCSeconds() / 3600;
}

// True si es horario nocturno (>= 20:30 o < 6:00).
export function esNoche(fecha: Date = new Date()): boolean {
  const h = horaCaracas(fecha);
  return h >= HORA_INICIO_NOCTURNO || h < HORA_FIN_NOCTURNO;
}

export function horaTextoCaracas(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(fecha);
}