/** Earth radius in meters (WGS84 mean). */
const EARTH_RADIUS_M = 6_371_000;

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two WGS84 points in meters (Haversine). */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function isInsideGeofence(
  lat: number,
  lng: number,
  siteLat: number,
  siteLng: number,
  radiusMeters: number,
): boolean {
  return distanceMeters(lat, lng, siteLat, siteLng) <= radiusMeters;
}

/** Calendar date YYYY-MM-DD in an IANA timezone. */
export function workDateInTimezone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Minutes from local midnight in `timeZone` for `instant`. */
export function localMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function weekdayInTimezone(instant: Date, timeZone: string): number {
  // en-US with weekday: 'short' is awkward; use formatToParts Sunday=0.
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(instant);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}
