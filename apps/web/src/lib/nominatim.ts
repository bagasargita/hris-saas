/** OpenStreetMap Nominatim (free). Respect usage policy: identify the app, ≤1 req/sec. */

export interface PlaceResult {
  placeId: string;
  label: string;
  latitude: number;
  longitude: number;
  address: string;
}

interface NominatimItem {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  type?: string;
  class?: string;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'id',
  // Policy: identify the application (no API key required).
  'User-Agent': 'saas-platform-attendance/0.1 (local-dev)',
};

function toPlace(item: NominatimItem): PlaceResult {
  return {
    placeId: String(item.place_id),
    label: item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    address: item.display_name,
  };
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '0');
  url.searchParams.set('limit', '6');

  const res = await fetch(url.toString(), { headers: HEADERS, signal });
  if (!res.ok) throw new Error('Pencarian tempat gagal');
  const data = (await res.json()) as NominatimItem[];
  return data.map(toPlace);
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const url = new URL(`${NOMINATIM}/reverse`);
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString(), { headers: HEADERS, signal });
  if (!res.ok) return null;
  const data = (await res.json()) as { display_name?: string };
  return data.display_name ?? null;
}
