import React, { useMemo, useState } from 'react';
import { Flame, Grid, Layers, MapPin } from 'lucide-react';
import { MUMBAI_DISTRICTS } from '../lib/constants';
import {
  computeDistrictSkillMatrix,
  computeMumbaiZoneHeatmap,
  type HeatmapMetricMode,
  type ZoneHeatmapCell,
} from '../lib/heatmap';
import type {
  ContractorProfile,
  MumbaiDistrict,
  ServiceBooking,
  ShopProfile,
  TechnicianProfile,
  ZoneCluster,
} from '../types';

interface AdminZoneHeatmapProps {
  zones: ZoneCluster[];
  technicians: TechnicianProfile[];
  shops: ShopProfile[];
  contractors: ContractorProfile[];
  bookings: ServiceBooking[];
  selectedZone: string;
  onSelectZone: (zoneName: string) => void;
}

type SortOrder = 'density_desc' | 'underserved_first' | 'alpha';
type HeatmapTab = 'grid' | 'matrix';

const HEAT_TILE_STYLES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-400',
  1: 'bg-amber-50 border-amber-200 text-slate-900 hover:border-amber-400',
  2: 'bg-amber-200 border-amber-300 text-slate-950 hover:border-amber-500',
  3: 'bg-orange-600 border-orange-700 text-white hover:border-orange-900',
  4: 'bg-rose-700 border-rose-800 text-white hover:border-rose-950',
};

const HEAT_SUBTEXT_STYLES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'text-slate-500',
  1: 'text-slate-600',
  2: 'text-amber-950/80',
  3: 'text-orange-100',
  4: 'text-rose-100',
};

const MATRIX_CELL_STYLES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-slate-50 text-slate-400',
  1: 'bg-amber-50 text-amber-900',
  2: 'bg-amber-200 text-slate-950',
  3: 'bg-orange-500 text-white',
  4: 'bg-rose-700 text-white',
};

const ORDERED_DISTRICTS: Array<Exclude<MumbaiDistrict, 'All Mumbai'>> = [
  'Mumbai City',
  'Western Suburbs',
  'Eastern Suburbs',
  'Harbour',
];

export const AdminZoneHeatmap: React.FC<AdminZoneHeatmapProps> = ({
  zones,
  technicians,
  shops,
  contractors,
  bookings,
  selectedZone,
  onSelectZone,
}) => {
  const [viewMode, setViewMode] = useState<HeatmapTab>('grid');
  const [metricMode, setMetricMode] = useState<HeatmapMetricMode>('providers');
  const [districtFilter, setDistrictFilter] = useState<MumbaiDistrict>('All Mumbai');
  const [sortOrder, setSortOrder] = useState<SortOrder>('density_desc');
  const [hoveredZoneName, setHoveredZoneName] = useState<string | null>(null);

  const { cells, districtSummaries, maxMetricValue } = useMemo(
    () =>
      computeMumbaiZoneHeatmap({
        zones,
        technicians,
        shops,
        contractors,
        bookings,
        metricMode,
      }),
    [zones, technicians, shops, contractors, bookings, metricMode]
  );

  const { rows: matrixRows, maxCellCount } = useMemo(
    () => computeDistrictSkillMatrix(technicians),
    [technicians]
  );

  const sortedCells = useMemo(() => {
    const filtered =
      districtFilter === 'All Mumbai'
        ? cells
        : cells.filter((c) => c.district === districtFilter);

    const copy = [...filtered];
    if (sortOrder === 'density_desc') {
      copy.sort(
        (a, b) =>
          b.metricValue - a.metricValue ||
          b.availableTechs - a.availableTechs ||
          a.zoneName.localeCompare(b.zoneName)
      );
    } else if (sortOrder === 'underserved_first') {
      copy.sort(
        (a, b) =>
          a.metricValue - b.metricValue ||
          b.bookingsCount - a.bookingsCount ||
          a.zoneName.localeCompare(b.zoneName)
      );
    } else {
      copy.sort((a, b) => a.zoneName.localeCompare(b.zoneName));
    }
    return copy;
  }, [cells, districtFilter, sortOrder]);

  const groupedByDistrict = useMemo(() => {
    const activeDistricts =
      districtFilter === 'All Mumbai' ? ORDERED_DISTRICTS : [districtFilter];

    return activeDistricts
      .map((dist) => ({
        district: dist,
        summary: districtSummaries.find((s) => s.district === dist),
        items: sortedCells.filter((c) => c.district === dist),
      }))
      .filter((group) => group.items.length > 0);
  }, [sortedCells, districtFilter, districtSummaries]);

  const inspectedCell: ZoneHeatmapCell | null = useMemo(() => {
    const targetName = hoveredZoneName || (selectedZone !== 'All' ? selectedZone : null);
    if (targetName) {
      return cells.find((c) => c.zoneName === targetName) || null;
    }
    return (
      [...cells].sort((a, b) => b.totalProviders - a.totalProviders)[0] || null
    );
  }, [cells, hoveredZoneName, selectedZone]);

  const metricLabel =
    metricMode === 'providers'
      ? 'Total Providers'
      : metricMode === 'available_techs'
        ? 'Available Techs'
        : metricMode === 'shops_contractors'
          ? 'Shops & Contractors'
          : 'Bookings Demand';

  const totalUnderservedCount = useMemo(
    () => cells.filter((c) => c.availableTechs === 0 && c.shopsCount === 0).length,
    [cells]
  );

  return (
    <section
      aria-labelledby="admin-heatmap-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
    >
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-600 shrink-0" aria-hidden="true" />
            <h3 id="admin-heatmap-heading" className="text-base font-semibold text-slate-900">
              Mumbai Technician &amp; Service Provider Density Heatmap
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Operational thermal intensity across{' '}
            <span className="font-mono tabular-nums font-medium text-slate-700">{cells.length}</span> Mumbai City &amp; Suburban zones ·{' '}
            <span className="font-mono tabular-nums font-medium text-slate-700">{totalUnderservedCount}</span> zero-coverage cold spots
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle: Thermal Tile Grid vs Trade x District Matrix */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Zone Heatmap</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'matrix'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Trade × District</span>
            </button>
          </div>
        </div>
      </div>

      {/* District Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {districtSummaries.map((dist) => {
          const isCurrent = districtFilter === dist.district;
          return (
            <button
              key={dist.district}
              type="button"
              onClick={() => setDistrictFilter(isCurrent ? 'All Mumbai' : dist.district)}
              className={`text-left rounded-lg border p-3.5 transition-colors ${
                isCurrent
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-900 truncate">{dist.district}</span>
                <span className="font-mono tabular-nums text-slate-500 shrink-0">
                  {dist.zoneCount} zones
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2 font-mono tabular-nums">
                <div>
                  <span className="text-lg font-bold text-slate-900">{dist.totalProviders}</span>
                  <span className="text-[11px] font-sans text-slate-500 ml-1">providers</span>
                </div>
                <div className="text-[11px] text-slate-600">
                  {dist.availableTechs} avail · {dist.bookingsCount} jobs
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {viewMode === 'grid' && (
        <>
          {/* Filter, Metric Layer & Color Scale Legend */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100">
                {(
                  [
                    ['providers', 'All Providers'],
                    ['available_techs', 'Available Techs'],
                    ['shops_contractors', 'Shops & Contractors'],
                    ['bookings', 'Bookings Demand'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setMetricMode(mode)}
                    className={`min-h-[32px] px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      metricMode === mode
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value as MumbaiDistrict)}
                aria-label="Filter heatmap by Mumbai district"
                className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
              >
                {MUMBAI_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                aria-label="Sort heatmap zones"
                className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
              >
                <option value="density_desc">Sort: Highest Density</option>
                <option value="underserved_first">Sort: Underserved First</option>
                <option value="alpha">Sort: Zone A–Z</option>
              </select>
            </div>

            {/* 5-Step Thermal Legend */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 font-mono tabular-nums">
              <span className="font-sans text-slate-500 mr-1">Heat Scale ({metricLabel}):</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded border border-slate-300 bg-slate-50 inline-block" />
                <span>0</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded border border-amber-300 bg-amber-50 inline-block" />
                <span>Low</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded border border-amber-400 bg-amber-200 inline-block" />
                <span>Med</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded border border-orange-700 bg-orange-600 inline-block" />
                <span>High</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded border border-rose-900 bg-rose-700 inline-block" />
                <span>Peak ({maxMetricValue})</span>
              </span>
            </div>
          </div>

          {cells.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-600">
              No active Mumbai clusters found in Firestore. Use &ldquo;Sync All Mumbai Zones&rdquo; in the Mumbai Clusters tab to populate localities.
            </div>
          ) : (
            <div className="space-y-5">
              {groupedByDistrict.map((group) => (
                <div key={group.district} className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-xs">
                    <span className="font-semibold text-slate-900">{group.district}</span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {group.items.length} localities · {group.summary?.totalProviders ?? 0} providers ·{' '}
                      {group.summary?.availableTechs ?? 0} avail techs
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                    {group.items.map((cell) => {
                      const isSelected = selectedZone === cell.zoneName;
                      return (
                        <button
                          key={cell.zoneId}
                          type="button"
                          onMouseEnter={() => setHoveredZoneName(cell.zoneName)}
                          onMouseLeave={() => setHoveredZoneName(null)}
                          onFocus={() => setHoveredZoneName(cell.zoneName)}
                          onClick={() =>
                            onSelectZone(isSelected ? 'All' : cell.zoneName)
                          }
                          aria-pressed={isSelected}
                          aria-label={`${cell.zoneName}, ${cell.district}: ${cell.metricValue} ${metricLabel}, ${cell.availableTechs} available technicians`}
                          className={`rounded-lg border p-2.5 text-left transition-colors flex flex-col justify-between min-h-[76px] ${
                            HEAT_TILE_STYLES[cell.heatLevel]
                          } ${isSelected ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="text-xs font-semibold leading-tight truncate">
                              {cell.zoneName}
                            </span>
                            <span className="text-sm font-bold font-mono tabular-nums leading-none shrink-0">
                              {cell.metricValue}
                            </span>
                          </div>
                          <div
                            className={`text-[10px] font-mono tabular-nums mt-2 truncate ${
                              HEAT_SUBTEXT_STYLES[cell.heatLevel]
                            }`}
                          >
                            {cell.availableTechs}T · {cell.shopsCount}S · {cell.contractorsCount}C
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Inspector Bar for Hovered / Selected Locality */}
          {inspectedCell && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="font-semibold text-slate-900 text-sm">{inspectedCell.zoneName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{inspectedCell.district}</span>
                  {inspectedCell.subZones.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{inspectedCell.subZones.join(', ')}</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-slate-600">
                  {inspectedCell.topSkills.length > 0 ? (
                    <>
                      Top local trades:{' '}
                      <span className="font-medium text-slate-800">
                        {inspectedCell.topSkills
                          .map((s) => `${s.skill} (${s.count})`)
                          .join(' · ')}
                      </span>
                    </>
                  ) : (
                    'No technicians registered in this cluster yet — candidate for onboarding drive.'
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums shrink-0">
                <div>
                  <span className="text-slate-500 font-sans">Avail/Total Techs: </span>
                  <strong className="text-slate-900">
                    {inspectedCell.availableTechs}/{inspectedCell.totalTechs}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">Shops: </span>
                  <strong className="text-slate-900">{inspectedCell.shopsCount}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">Contractors: </span>
                  <strong className="text-slate-900">{inspectedCell.contractorsCount}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">Bookings: </span>
                  <strong className="text-slate-900">{inspectedCell.bookingsCount}</strong>
                </div>
                {selectedZone !== 'All' && (
                  <button
                    type="button"
                    onClick={() => onSelectZone('All')}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-sans font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {viewMode === 'matrix' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Technician headcount intensity by Trade Category across Mumbai Districts</span>
            <span className="font-mono tabular-nums">Max cell: {maxCellCount}</span>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 pl-3 pr-4 font-semibold">Skill Category</th>
                  {ORDERED_DISTRICTS.map((dist) => (
                    <th key={dist} className="py-2.5 px-3 text-center font-semibold whitespace-nowrap">
                      {dist}
                    </th>
                  ))}
                  <th className="py-2.5 pl-3 pr-3 text-right font-semibold">All Mumbai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {matrixRows.map((row) => (
                  <tr key={row.skill} className="hover:bg-slate-50/60">
                    <td className="py-2 pl-3 pr-4 font-sans font-medium text-slate-900 whitespace-nowrap">
                      {row.skill}
                    </td>
                    {ORDERED_DISTRICTS.map((dist) => {
                      const count = row.counts[dist];
                      const ratio = maxCellCount > 0 ? count / maxCellCount : 0;
                      const level: 0 | 1 | 2 | 3 | 4 =
                        count === 0
                          ? 0
                          : ratio <= 0.25
                            ? 1
                            : ratio <= 0.5
                              ? 2
                              : ratio <= 0.75
                                ? 3
                                : 4;
                      return (
                        <td key={dist} className="p-1.5 text-center">
                          <div
                            className={`rounded-md py-1.5 px-2 font-semibold ${MATRIX_CELL_STYLES[level]}`}
                          >
                            {count}
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-2 pl-3 pr-3 text-right font-bold text-slate-900">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
