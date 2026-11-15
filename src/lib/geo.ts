export interface LatLng {
  lat: number;
  lng: number;
}

export const MUMBAI_CENTER: LatLng = { lat: 19.076, lng: 72.8777 };

// Approximate WGS84 coordinates for Mumbai launch clusters, South Mumbai, Western, Eastern, and Harbour suburbs
export const MUMBAI_COORDS: Record<string, LatLng> = {
  // Core 8 Launch Clusters
  colaba: { lat: 18.9067, lng: 72.8147 },
  mahim: { lat: 19.0354, lng: 72.8423 },
  bandra: { lat: 19.0596, lng: 72.8295 },
  khar: { lat: 19.0708, lng: 72.8338 },
  santacruz: { lat: 19.0843, lng: 72.836 },
  andheri: { lat: 19.1136, lng: 72.8697 },
  jogeshwari: { lat: 19.1363, lng: 72.8496 },
  borivali: { lat: 19.2307, lng: 72.8567 },

  // South Mumbai / Mumbai City Neighbourhoods & Localities
  'nariman point': { lat: 18.9256, lng: 72.8242 },
  fort: { lat: 18.9345, lng: 72.8355 },
  kalbadevi: { lat: 18.9482, lng: 72.8295 },
  bhuleshwar: { lat: 18.9522, lng: 72.8296 },
  mandvi: { lat: 18.9525, lng: 72.8398 },
  girgaon: { lat: 18.9548, lng: 72.8172 },
  dongri: { lat: 18.9592, lng: 72.8392 },
  umarkhadi: { lat: 18.9605, lng: 72.8362 },
  'opera house': { lat: 18.9565, lng: 72.8152 },
  'malabar hill': { lat: 18.9548, lng: 72.7985 },
  gamdevi: { lat: 18.9612, lng: 72.8105 },
  'grant road': { lat: 18.9636, lng: 72.8165 },
  kamathipura: { lat: 18.9648, lng: 72.8252 },
  nagpada: { lat: 18.9682, lng: 72.8292 },
  'cumballa hill': { lat: 18.9692, lng: 72.8058 },
  'cumbala hill': { lat: 18.9692, lng: 72.8058 },
  mazgaon: { lat: 18.9688, lng: 72.8458 },
  tardeo: { lat: 18.9722, lng: 72.8135 },
  agripada: { lat: 18.9765, lng: 72.8258 },
  byculla: { lat: 18.9792, lng: 72.8332 },
  chinchpokli: { lat: 18.9865, lng: 72.8338 },
  'lower parel': { lat: 18.9956, lng: 72.8295 },
  parel: { lat: 19.0008, lng: 72.8415 },
  sewri: { lat: 18.9985, lng: 72.8548 },
  worli: { lat: 19.0176, lng: 72.8162 },
  prabhadevi: { lat: 19.0142, lng: 72.8298 },
  naigaon: { lat: 19.0155, lng: 72.8475 },
  dadar: { lat: 19.0178, lng: 72.8442 },
  matunga: { lat: 19.0269, lng: 72.8553 },
  'antop hill': { lat: 19.0265, lng: 72.8675 },
  sion: { lat: 19.0434, lng: 72.8633 },
  dharavi: { lat: 19.0422, lng: 72.8512 },

  // 1. Western Suburbs (Andheri & Borivali Talukas)
  'vile parle': { lat: 19.0996, lng: 72.8442 },
  juhu: { lat: 19.1075, lng: 72.8263 },
  goregaon: { lat: 19.1663, lng: 72.8526 },
  malad: { lat: 19.1874, lng: 72.8484 },
  kandivali: { lat: 19.2094, lng: 72.8526 },
  dahisar: { lat: 19.2575, lng: 72.8591 },
  'gorai & manori': { lat: 19.2345, lng: 72.7855 },

  // 2. Eastern Suburbs (Kurla Taluka)
  kurla: { lat: 19.0726, lng: 72.8845 },
  vidyavihar: { lat: 19.0798, lng: 72.8973 },
  ghatkopar: { lat: 19.086, lng: 72.908 },
  vikhroli: { lat: 19.1112, lng: 72.9278 },
  kanjurmarg: { lat: 19.1287, lng: 72.9284 },
  bhandup: { lat: 19.144, lng: 72.9381 },
  mulund: { lat: 19.1726, lng: 72.9565 },
  powai: { lat: 19.1176, lng: 72.906 },

  // 3. Harbour / Central Suburbs & Trombay Area
  chembur: { lat: 19.0522, lng: 72.9005 },
  govandi: { lat: 19.0554, lng: 72.9154 },
  mankhurd: { lat: 19.0485, lng: 72.9322 },
  trombay: { lat: 19.0265, lng: 72.9385 },
  thane: { lat: 19.2183, lng: 72.9781 },
};

export const DISTANCE_FILTER_OPTIONS = [
  { value: 'all', label: 'Any Distance' },
  { value: '3', label: 'Within 3 km' },
  { value: '5', label: 'Within 5 km' },
  { value: '10', label: 'Within 10 km' },
  { value: '15', label: 'Within 15 km' },
  { value: '25', label: 'Within 25 km' },
] as const;

export type DistanceLimitOption = 'all' | '3' | '5' | '10' | '15' | '25';

export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function getZoneCoords(zoneName?: string | null): LatLng | null {
  if (!zoneName) return null;
  const normalized = zoneName.trim().toLowerCase();
  if (!normalized) return null;
  if (MUMBAI_COORDS[normalized]) {
    return MUMBAI_COORDS[normalized];
  }
  const matchingKey = Object.keys(MUMBAI_COORDS).find(
    (k) => normalized.includes(k) || k.includes(normalized)
  );
  return matchingKey ? MUMBAI_COORDS[matchingKey] : null;
}

export function getDistanceToZoneKm(origin: LatLng | null, zoneName?: string | null): number | null {
  if (!origin || !zoneName) return null;
  const target = getZoneCoords(zoneName);
  if (!target) return null;
  return haversineDistanceKm(origin, target);
}

export function getTechnicianDistanceFromOrigin(
  origin: LatLng | null,
  tech: { clusterZone: string; preferredLocations?: string[]; workingRadiusKm: number }
): { distanceKm: number; matchedZone: string; withinServiceRadius: boolean } | null {
  if (!origin) return null;
  const candidateZones = [tech.clusterZone, ...(tech.preferredLocations || [])].filter(Boolean);
  let best: { distanceKm: number; matchedZone: string } | null = null;

  for (const zone of candidateZones) {
    const d = getDistanceToZoneKm(origin, zone);
    if (d !== null && (best === null || d < best.distanceKm)) {
      best = { distanceKm: d, matchedZone: zone };
    }
  }

  if (!best) return null;
  const primaryDist = getDistanceToZoneKm(origin, tech.clusterZone);
  const withinServiceRadius =
    (primaryDist !== null && primaryDist <= (tech.workingRadiusKm || 5)) ||
    best.distanceKm <= (tech.workingRadiusKm || 5);

  return {
    distanceKm: best.distanceKm,
    matchedZone: best.matchedZone,
    withinServiceRadius,
  };
}

export function findNearestMumbaiZone(
  coords: LatLng,
  preferredZoneNames?: string[]
): { zoneName: string; distanceKm: number; coords: LatLng } {
  const candidates: Array<{ name: string; coords: LatLng }> = [];

  if (preferredZoneNames && preferredZoneNames.length > 0) {
    for (const name of preferredZoneNames) {
      const c = getZoneCoords(name);
      if (c) candidates.push({ name, coords: c });
    }
  }

  if (candidates.length === 0) {
    for (const [key, c] of Object.entries(MUMBAI_COORDS)) {
      const title = key
        .split(' ')
        .map((w) => (w === '&' ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(' ');
      candidates.push({ name: title, coords: c });
    }
  }

  let closest = candidates[0];
  let bestDist = haversineDistanceKm(coords, closest.coords);

  for (let i = 1; i < candidates.length; i++) {
    const d = haversineDistanceKm(coords, candidates[i].coords);
    if (d < bestDist) {
      bestDist = d;
      closest = candidates[i];
    }
  }

  return {
    zoneName: closest.name,
    distanceKm: bestDist,
    coords: closest.coords,
  };
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km)) return '';
  if (km < 0.1) return '0.1 km';
  if (km >= 100) return `${Math.round(km)} km`;
  return `${km.toFixed(1)} km`;
}
