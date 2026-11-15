import { getMumbaiDistrict, SKILL_CATEGORIES } from './constants';
import type {
  ContractorProfile,
  MumbaiDistrict,
  ServiceBooking,
  ShopProfile,
  TechnicianProfile,
  ZoneCluster,
} from '../types';

export type HeatmapMetricMode = 'providers' | 'available_techs' | 'shops_contractors' | 'bookings';

export interface ZoneHeatmapCell {
  zoneId: string;
  zoneName: string;
  subZones: string[];
  district: Exclude<MumbaiDistrict, 'All Mumbai'>;
  totalTechs: number;
  availableTechs: number;
  busyTechs: number;
  unavailableTechs: number;
  shopsCount: number;
  contractorsCount: number;
  totalProviders: number;
  bookingsCount: number;
  demandSupplyGap: number; // bookings minus availableTechs
  topSkills: Array<{ skill: string; count: number }>;
  metricValue: number;
  intensityRatio: number; // 0..1 normalized across active zones
  heatLevel: 0 | 1 | 2 | 3 | 4;
}

export interface DistrictHeatmapSummary {
  district: Exclude<MumbaiDistrict, 'All Mumbai'>;
  zoneCount: number;
  totalProviders: number;
  availableTechs: number;
  totalTechs: number;
  shopsCount: number;
  contractorsCount: number;
  bookingsCount: number;
  underservedZones: number;
}

export interface SkillDistrictMatrixRow {
  skill: string;
  counts: Record<Exclude<MumbaiDistrict, 'All Mumbai'>, number>;
  total: number;
}

const DISTRICT_LIST: Array<Exclude<MumbaiDistrict, 'All Mumbai'>> = [
  'Mumbai City',
  'Western Suburbs',
  'Eastern Suburbs',
  'Harbour',
];

function computeHeatLevel(value: number, maxValue: number): { ratio: number; level: 0 | 1 | 2 | 3 | 4 } {
  if (value <= 0 || maxValue <= 0) {
    return { ratio: 0, level: 0 };
  }
  const ratio = Math.min(1, value / maxValue);
  if (ratio <= 0.25) return { ratio, level: 1 };
  if (ratio <= 0.5) return { ratio, level: 2 };
  if (ratio <= 0.75) return { ratio, level: 3 };
  return { ratio, level: 4 };
}

export function computeMumbaiZoneHeatmap(params: {
  zones: ZoneCluster[];
  technicians: TechnicianProfile[];
  shops: ShopProfile[];
  contractors: ContractorProfile[];
  bookings: ServiceBooking[];
  metricMode: HeatmapMetricMode;
}): {
  cells: ZoneHeatmapCell[];
  districtSummaries: DistrictHeatmapSummary[];
  maxMetricValue: number;
} {
  const { zones, technicians, shops, contractors, bookings, metricMode } = params;
  const activeZones = zones.filter((z) => z.active);

  const rawRows = activeZones.map((zone) => {
    const zoneTechs = technicians.filter(
      (t) =>
        t.clusterZone === zone.name ||
        (Array.isArray(t.preferredLocations) && t.preferredLocations.includes(zone.name))
    );
    const primaryTechs = technicians.filter((t) => t.clusterZone === zone.name);
    const availableTechs = zoneTechs.filter((t) => t.availabilityStatus === 'Available').length;
    const busyTechs = primaryTechs.filter((t) => t.availabilityStatus === 'Busy').length;
    const unavailableTechs = primaryTechs.filter((t) => t.availabilityStatus === 'Unavailable').length;

    const shopsCount = shops.filter((s) => s.clusterZone === zone.name).length;
    const contractorsCount = contractors.filter((c) => c.clusterZone === zone.name).length;
    const bookingsCount = bookings.filter((b) => b.clusterZone === zone.name).length;

    // De-duplicated provider headcount rooted in zoneTechs (plus primary shops & contractors)
    const totalProviders = zoneTechs.length + shopsCount + contractorsCount;

    const skillCounts = new Map<string, number>();
    for (const tech of zoneTechs) {
      skillCounts.set(tech.skillCategory, (skillCounts.get(tech.skillCategory) || 0) + 1);
    }
    const topSkills = Array.from(skillCounts.entries())
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const metricValue =
      metricMode === 'providers'
        ? totalProviders
        : metricMode === 'available_techs'
          ? availableTechs
          : metricMode === 'shops_contractors'
            ? shopsCount + contractorsCount
            : bookingsCount;

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      subZones: zone.subZones || [],
      district: getMumbaiDistrict(zone.name),
      totalTechs: zoneTechs.length,
      availableTechs,
      busyTechs,
      unavailableTechs,
      shopsCount,
      contractorsCount,
      totalProviders,
      bookingsCount,
      demandSupplyGap: bookingsCount - availableTechs,
      topSkills,
      metricValue,
    };
  });

  const maxMetricValue = Math.max(0, ...rawRows.map((r) => r.metricValue));

  const cells: ZoneHeatmapCell[] = rawRows.map((row) => {
    const { ratio, level } = computeHeatLevel(row.metricValue, maxMetricValue);
    return {
      ...row,
      intensityRatio: ratio,
      heatLevel: level,
    };
  });

  const districtSummaries: DistrictHeatmapSummary[] = DISTRICT_LIST.map((district) => {
    const distCells = cells.filter((c) => c.district === district);
    return {
      district,
      zoneCount: distCells.length,
      totalProviders: distCells.reduce((s, c) => s + c.totalProviders, 0),
      availableTechs: distCells.reduce((s, c) => s + c.availableTechs, 0),
      totalTechs: distCells.reduce((s, c) => s + c.totalTechs, 0),
      shopsCount: distCells.reduce((s, c) => s + c.shopsCount, 0),
      contractorsCount: distCells.reduce((s, c) => s + c.contractorsCount, 0),
      bookingsCount: distCells.reduce((s, c) => s + c.bookingsCount, 0),
      underservedZones: distCells.filter((c) => c.availableTechs === 0 && c.shopsCount === 0).length,
    };
  });

  return { cells, districtSummaries, maxMetricValue };
}

export function computeDistrictSkillMatrix(technicians: TechnicianProfile[]): {
  rows: SkillDistrictMatrixRow[];
  maxCellCount: number;
} {
  const presentSkills = new Set<string>(SKILL_CATEGORIES.slice(0, 12));
  for (const tech of technicians) {
    if (tech.skillCategory) presentSkills.add(tech.skillCategory);
  }

  let maxCellCount = 0;
  const rows: SkillDistrictMatrixRow[] = [];

  for (const skill of presentSkills) {
    const counts: Record<Exclude<MumbaiDistrict, 'All Mumbai'>, number> = {
      'Mumbai City': 0,
      'Western Suburbs': 0,
      'Eastern Suburbs': 0,
      Harbour: 0,
    };

    for (const tech of technicians) {
      if (tech.skillCategory !== skill) continue;
      const dist = getMumbaiDistrict(tech.clusterZone);
      counts[dist] += 1;
    }

    const total =
      counts['Mumbai City'] +
      counts['Western Suburbs'] +
      counts['Eastern Suburbs'] +
      counts.Harbour;

    for (const dist of DISTRICT_LIST) {
      if (counts[dist] > maxCellCount) maxCellCount = counts[dist];
    }

    rows.push({ skill, counts, total });
  }

  rows.sort((a, b) => b.total - a.total || a.skill.localeCompare(b.skill));
  return { rows, maxCellCount };
}
