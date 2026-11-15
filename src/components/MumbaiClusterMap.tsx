import React, { useMemo, useState } from 'react';
import { MapPin, Users, Wrench } from 'lucide-react';
import { MUMBAI_COORDS } from '../lib/geo';
import { getMumbaiDistrict, MUMBAI_DISTRICTS } from '../lib/constants';
import type {
  ContractorProfile,
  MumbaiDistrict,
  ServiceBooking,
  ShopProfile,
  TechnicianProfile,
  ZoneCluster,
} from '../types';

interface MumbaiClusterMapProps {
  zones: ZoneCluster[];
  technicians: TechnicianProfile[];
  shops: ShopProfile[];
  contractors: ContractorProfile[];
  bookings: ServiceBooking[];
  selectedZone: string;
  onSelectZone: (zoneName: string) => void;
}

const CORE_LABELS = new Set([
  'Colaba',
  'Fort',
  'Dadar',
  'Mahim',
  'Bandra',
  'Khar',
  'Santacruz',
  'Andheri',
  'Jogeshwari',
  'Malad',
  'Borivali',
  'Kurla',
  'Ghatkopar',
  'Powai',
  'Mulund',
  'Chembur',
]);

// Bounding box covering Mumbai City (Colaba) and Mumbai Suburban (Borivali / Mulund / Trombay)
const BOUNDS = {
  minLat: 18.885,
  maxLat: 19.27,
  minLng: 72.77,
  maxLng: 72.995,
};

const SVG_W = 560;
const SVG_H = 620;

function projectCoord(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * (SVG_W - 80) + 40;
  const y = (1 - (lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * (SVG_H - 70) + 35;
  return { x, y };
}

function resolveZonePosition(name: string, index: number): { x: number; y: number } {
  const key = name.trim().toLowerCase();
  if (MUMBAI_COORDS[key]) {
    return projectCoord(MUMBAI_COORDS[key].lat, MUMBAI_COORDS[key].lng);
  }
  // Deterministic fallback along the Mumbai corridor for custom admin-added areas
  const lat = 18.95 + ((index * 0.047) % 0.28);
  const lng = 72.83 + ((index * 0.031) % 0.11);
  return projectCoord(lat, lng);
}

// Simplified geographic polygon tracing Mumbai island & western suburbs coastline
const MUMBAI_LAND_POLYGON = [
  projectCoord(18.895, 72.808),
  projectCoord(18.905, 72.825),
  projectCoord(18.932, 72.836),
  projectCoord(18.965, 72.849),
  projectCoord(19.015, 72.865),
  projectCoord(19.042, 72.885),
  projectCoord(19.062, 72.925),
  projectCoord(19.105, 72.942),
  projectCoord(19.175, 72.968),
  projectCoord(19.255, 72.978),
  projectCoord(19.255, 72.825),
  projectCoord(19.215, 72.805),
  projectCoord(19.165, 72.815),
  projectCoord(19.115, 72.821),
  projectCoord(19.082, 72.822),
  projectCoord(19.055, 72.818),
  projectCoord(19.036, 72.836),
  projectCoord(19.012, 72.812),
  projectCoord(18.985, 72.804),
  projectCoord(18.952, 72.796),
  projectCoord(18.926, 72.815),
]
  .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  .join(' ');

export const MumbaiClusterMap: React.FC<MumbaiClusterMapProps> = ({
  zones,
  technicians,
  shops,
  contractors,
  bookings,
  selectedZone,
  onSelectZone,
}) => {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [metricMode, setMetricMode] = useState<'available' | 'all' | 'radius'>('available');
  const [districtFilter, setDistrictFilter] = useState<MumbaiDistrict>('All Mumbai');

  const clusterNodes = useMemo(() => {
    const activeZones = zones.filter((z) => z.active);
    const maxAvail = Math.max(
      1,
      ...activeZones.map(
        (z) =>
          technicians.filter(
            (t) =>
              t.availabilityStatus === 'Available' &&
              (t.clusterZone === z.name || (t.preferredLocations || []).includes(z.name))
          ).length
      )
    );

    return activeZones.map((z, idx) => {
      const pos = resolveZonePosition(z.name, idx);
      const primaryTechs = technicians.filter((t) => t.clusterZone === z.name);
      const coveringAvailableTechs = technicians.filter(
        (t) =>
          t.availabilityStatus === 'Available' &&
          (t.clusterZone === z.name || (t.preferredLocations || []).includes(z.name))
      );
      const availableCount = coveringAvailableTechs.length;
      const busyCount = primaryTechs.filter((t) => t.availabilityStatus === 'Busy').length;
      const unavailableCount = primaryTechs.filter((t) => t.availabilityStatus === 'Unavailable').length;
      const shopCount = shops.filter((s) => s.clusterZone === z.name).length;
      const contractorCount = contractors.filter((c) => c.clusterZone === z.name).length;
      const bookingCount = bookings.filter((b) => b.clusterZone === z.name).length;

      const avgRadiusKm =
        coveringAvailableTechs.length > 0
          ? coveringAvailableTechs.reduce((acc, t) => acc + (t.workingRadiusKm || 5), 0) /
            coveringAvailableTechs.length
          : 5;

      const densityRatio = availableCount / maxAvail;
      const skillBreakdown = coveringAvailableTechs.reduce<Record<string, number>>((acc, t) => {
        acc[t.skillCategory] = (acc[t.skillCategory] || 0) + 1;
        return acc;
      }, {});

      return {
        zone: z,
        district: getMumbaiDistrict(z.name),
        x: pos.x,
        y: pos.y,
        availableCount,
        primaryTotal: primaryTechs.length,
        busyCount,
        unavailableCount,
        shopCount,
        contractorCount,
        bookingCount,
        avgRadiusKm,
        densityRatio,
        skillBreakdown,
      };
    });
  }, [zones, technicians, shops, contractors, bookings]);

  const visibleClusterNodes = useMemo(() => {
    if (districtFilter === 'All Mumbai') return clusterNodes;
    return clusterNodes.filter((node) => node.district === districtFilter);
  }, [clusterNodes, districtFilter]);

  const districtSummary = useMemo(() => {
    const counts: Record<Exclude<MumbaiDistrict, 'All Mumbai'>, { zones: number; available: number }> = {
      'Mumbai City': { zones: 0, available: 0 },
      'Western Suburbs': { zones: 0, available: 0 },
      'Eastern Suburbs': { zones: 0, available: 0 },
      Harbour: { zones: 0, available: 0 },
    };
    for (const node of clusterNodes) {
      counts[node.district].zones += 1;
      counts[node.district].available += node.availableCount;
    }
    return counts;
  }, [clusterNodes]);

  const focusedNode = useMemo(() => {
    const pool = visibleClusterNodes.length > 0 ? visibleClusterNodes : clusterNodes;
    const target = hoveredZone || (selectedZone !== 'All' ? selectedZone : null);
    if (target) {
      return pool.find((n) => n.zone.name === target) || clusterNodes.find((n) => n.zone.name === target) || pool[0] || null;
    }
    return [...pool].sort((a, b) => b.availableCount - a.availableCount)[0] || null;
  }, [visibleClusterNodes, clusterNodes, hoveredZone, selectedZone]);

  const totalAvailableAcrossMumbai = useMemo(
    () => technicians.filter((t) => t.availabilityStatus === 'Available').length,
    [technicians]
  );

  // Corridor polyline connecting the core north-south Mumbai spine
  const spinePoints = useMemo(() => {
    const order = ['Colaba', 'Mahim', 'Bandra', 'Khar', 'Santacruz', 'Andheri', 'Jogeshwari', 'Borivali'];
    return order
      .map((name) => clusterNodes.find((n) => n.zone.name === name))
      .filter((n): n is NonNullable<typeof n> => Boolean(n))
      .map((n) => `${n.x.toFixed(1)},${n.y.toFixed(1)}`)
      .join(' ');
  }, [clusterNodes]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Mumbai Service Cluster Map & Available Technician Density
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Live geospatial distribution across Mumbai City &amp; Suburban zones ({visibleClusterNodes.length} shown of {clusterNodes.length} active clusters) ·{' '}
            <span className="font-mono tabular-nums text-slate-700 font-medium">
              {totalAvailableAcrossMumbai}
            </span>{' '}
            available technicians citywide
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 w-fit">
            {(
              [
                ['available', 'Available Density'],
                ['all', 'Total Workforce'],
                ['radius', 'Service Radius'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setMetricMode(mode)}
                className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  metricMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mumbai City & Suburban District Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100">
          {MUMBAI_DISTRICTS.map((dist) => {
            const countInfo =
              dist === 'All Mumbai'
                ? { zones: clusterNodes.length, available: totalAvailableAcrossMumbai }
                : districtSummary[dist];
            return (
              <button
                key={dist}
                type="button"
                onClick={() => setDistrictFilter(dist)}
                className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  districtFilter === dist
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {dist} ({countInfo.zones})
              </button>
            );
          })}
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-500">
          City: {districtSummary['Mumbai City'].zones} · West: {districtSummary['Western Suburbs'].zones} · East: {districtSummary['Eastern Suburbs'].zones} · Harbour: {districtSummary.Harbour.zones}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Interactive Mumbai Vector Map */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-slate-950 overflow-hidden relative flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 text-xs text-slate-300">
            <span>{districtFilter} · 18.89°N – 19.27°N · 72.77°E – 72.99°E</span>
            {selectedZone !== 'All' && (
              <button
                type="button"
                onClick={() => onSelectZone('All')}
                className="text-amber-400 hover:text-amber-300 font-medium"
              >
                Reset Filter ({selectedZone})
              </button>
            )}
          </div>

          <div className="relative flex-1 min-h-[380px] flex items-center justify-center p-2">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              role="img"
              aria-label="Map of Mumbai active service clusters and available technician density"
              className="w-full h-full max-h-[460px]"
            >
              <defs>
                <radialGradient id="densityGlowHigh" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.55" />
                  <stop offset="65%" stopColor="#10B981" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="densityGlowAmber" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#D97706" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Subtle Coordinate Grid */}
              {[120, 240, 360, 480].map((gx) => (
                <line key={`gx-${gx}`} x1={gx} y1={0} x2={gx} y2={SVG_H} stroke="#1E293B" strokeWidth={1} strokeDasharray="3 5" />
              ))}
              {[120, 240, 360, 480].map((gy) => (
                <line key={`gy-${gy}`} x1={0} y1={gy} x2={SVG_W} y2={gy} stroke="#1E293B" strokeWidth={1} strokeDasharray="3 5" />
              ))}

              {/* Arabian Sea Label */}
              <text x={54} y={390} fill="#475569" fontSize="11" letterSpacing="2">
                ARABIAN SEA
              </text>

              {/* Mumbai Landmass Silhouette */}
              <polygon
                points={MUMBAI_LAND_POLYGON}
                fill="#0F172A"
                stroke="#334155"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />

              {/* Western Rail / Highway Spine */}
              {spinePoints && (
                <polyline
                  points={spinePoints}
                  fill="none"
                  stroke="#475569"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
              )}

              {/* Cluster Density Layers & Interactive Pins */}
              {visibleClusterNodes.map((node) => {
                const isSelected = selectedZone === node.zone.name;
                const isFocused = focusedNode?.zone.id === node.zone.id;
                const metricValue =
                  metricMode === 'available'
                    ? node.availableCount
                    : metricMode === 'all'
                      ? node.primaryTotal
                      : Math.round(node.avgRadiusKm);

                const haloRadius =
                  metricMode === 'radius'
                    ? node.avgRadiusKm * 5.2
                    : 18 + node.densityRatio * 34;

                const hasAvail = node.availableCount > 0;
                const nodeFill = hasAvail ? '#10B981' : '#64748B';

                const showLabel =
                  districtFilter !== 'All Mumbai' ||
                  CORE_LABELS.has(node.zone.name) ||
                  isSelected ||
                  isFocused ||
                  node.availableCount > 0;

                const markerRadius =
                  districtFilter !== 'All Mumbai' || CORE_LABELS.has(node.zone.name) || isSelected || isFocused
                    ? 10
                    : 6.5;

                return (
                  <g
                    key={node.zone.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredZone(node.zone.name)}
                    onMouseLeave={() => setHoveredZone(null)}
                    onClick={() =>
                      onSelectZone(selectedZone === node.zone.name ? 'All' : node.zone.name)
                    }
                  >
                    {/* Density / Coverage Halo */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={CORE_LABELS.has(node.zone.name) || node.availableCount > 0 ? haloRadius : 12}
                      fill={hasAvail ? 'url(#densityGlowHigh)' : 'url(#densityGlowAmber)'}
                    />
                    {metricMode === 'radius' && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={haloRadius}
                        fill="none"
                        stroke="#10B981"
                        strokeOpacity={0.4}
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Focus Ring */}
                    {(isSelected || isFocused) && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={16}
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth={2}
                      />
                    )}

                    {/* Cluster Marker Circle */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={markerRadius}
                      fill={isSelected ? '#D97706' : nodeFill}
                      stroke="#0F172A"
                      strokeWidth={1.5}
                    />

                    {/* Count Inside Marker */}
                    {markerRadius >= 10 && (
                      <text
                        x={node.x}
                        y={node.y + 3.5}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="9.5"
                        fontWeight="700"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {metricValue}
                      </text>
                    )}

                    {/* Cluster Name Label */}
                    {showLabel && (
                      <text
                        x={node.x + markerRadius + 5}
                        y={node.y + 3.5}
                        fill={isSelected || isFocused ? '#F8FAFC' : '#CBD5E1'}
                        fontSize="10.5"
                        fontWeight={isSelected || isFocused ? '600' : '500'}
                      >
                        {node.zone.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Map Legend Footer */}
          <div className="px-4 py-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Available Coverage
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block" />
                0 Available
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
                Selected Filter
              </span>
            </div>
            <span>Click any cluster to filter dashboard</span>
          </div>
        </div>

        {/* Cluster Density Inspector & Ranked Density Bars */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
          {focusedNode ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    <span>Mumbai Cluster Focus</span>
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mt-0.5">{focusedNode.zone.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {focusedNode.zone.subZones.length > 0
                      ? focusedNode.zone.subZones.join(' · ')
                      : 'Primary service cluster'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onSelectZone(selectedZone === focusedNode.zone.name ? 'All' : focusedNode.zone.name)
                  }
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                >
                  {selectedZone === focusedNode.zone.name ? 'Show All' : 'Filter Zone'}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <div className="text-[11px] text-slate-500">Available Techs</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-emerald-700">
                    {focusedNode.availableCount}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Busy / Off</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-slate-700">
                    {focusedNode.busyCount + focusedNode.unavailableCount}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Avg Radius</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                    {focusedNode.avgRadiusKm.toFixed(0)} km
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-200 font-mono tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  Shops: {focusedNode.shopCount} · Contractors: {focusedNode.contractorCount}
                </span>
                <span>Bookings: {focusedNode.bookingCount}</span>
              </div>

              {Object.keys(focusedNode.skillBreakdown).length > 0 && (
                <div className="pt-2 border-t border-slate-200 space-y-1.5">
                  <div className="text-xs font-medium text-slate-700 flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5 text-amber-600" /> Available Skills in {focusedNode.zone.name}
                  </div>
                  <div className="text-xs text-slate-600">
                    {Object.entries(focusedNode.skillBreakdown)
                      .map(([skill, count]) => `${skill} (${count})`)
                      .join(' · ')}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Horizontal Density Comparison Bars */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900">Cluster Technician Density Breakdown ({districtFilter})</span>
              <span className="text-slate-500 font-mono">Available / Total</span>
            </div>
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {visibleClusterNodes.map((node) => {
                const widthPct = Math.round(node.densityRatio * 100);
                const isSelected = selectedZone === node.zone.name;
                return (
                  <button
                    key={node.zone.id}
                    type="button"
                    onClick={() =>
                      onSelectZone(isSelected ? 'All' : node.zone.name)
                    }
                    className={`w-full text-left space-y-1 p-1.5 rounded-lg transition-colors ${
                      isSelected ? 'bg-amber-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{node.zone.name}</span>
                      <span className="font-mono tabular-nums text-slate-600">
                        <strong className="text-emerald-700">{node.availableCount}</strong> / {node.primaryTotal}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isSelected ? 'bg-amber-600' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.max(node.availableCount > 0 ? 8 : 0, widthPct)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
