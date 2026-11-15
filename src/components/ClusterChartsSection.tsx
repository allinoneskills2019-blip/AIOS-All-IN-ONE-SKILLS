import React, { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { CORE_MUMBAI_CLUSTER_NAMES, getMumbaiDistrict, MUMBAI_DISTRICTS, MUMBAI_INITIAL_CLUSTERS } from '../lib/constants';
import type { MumbaiDistrict, ServiceBooking, TechnicianProfile, ZoneCluster } from '../types';

interface ClusterChartsSectionProps {
  zones: ZoneCluster[];
  technicians: TechnicianProfile[];
  bookings: ServiceBooking[];
  selectedZone: string;
  onSelectZone: (zoneName: string) => void;
}

const CLUSTER_COLORS = [
  '#0F172A',
  '#D97706',
  '#059669',
  '#2563EB',
  '#7C3AED',
  '#DC2626',
  '#0891B2',
  '#4F46E5',
  '#CA8A04',
  '#475569',
];

export const ClusterChartsSection: React.FC<ClusterChartsSectionProps> = ({
  zones,
  technicians,
  bookings,
  selectedZone,
  onSelectZone,
}) => {
  const [chartView, setChartView] = useState<'density' | 'stacked' | 'bookings'>('density');
  const [donutMode, setDonutMode] = useState<'clusters' | 'availability'>('clusters');
  const [zoneScope, setZoneScope] = useState<'core8' | MumbaiDistrict>('core8');

  // Guarantee the 8 core Mumbai clusters appear in South-to-North order, plus South Mumbai / Admin-added clusters
  const orderedClusters = useMemo(() => {
    const coreNames = [...CORE_MUMBAI_CLUSTER_NAMES];
    const activeMap = new Map<string, ZoneCluster>();

    zones
      .filter((z) => z.active)
      .forEach((z) => activeMap.set(z.name.toLowerCase(), z));

    const result: Array<{ id: string; name: string; subZonesCount: number; isCore: boolean }> = [];

    coreNames.forEach((name) => {
      const existing = activeMap.get(name.toLowerCase());
      const fallback = MUMBAI_INITIAL_CLUSTERS.find((c) => c.name === name);
      result.push({
        id: existing?.id || fallback?.id || name.toLowerCase(),
        name,
        subZonesCount: existing?.subZones?.length ?? fallback?.subZones.length ?? 0,
        isCore: true,
      });
      activeMap.delete(name.toLowerCase());
    });

    activeMap.forEach((extra) => {
      result.push({
        id: extra.id,
        name: extra.name,
        subZonesCount: extra.subZones?.length ?? 0,
        isCore: false,
      });
    });

    return result;
  }, [zones]);

  const clusterChartData = useMemo(() => {
    return orderedClusters.map((cluster) => {
      const zoneTechs = technicians.filter((t) => t.clusterZone === cluster.name);
      const available = zoneTechs.filter((t) => t.availabilityStatus === 'Available').length;
      const busy = zoneTechs.filter((t) => t.availabilityStatus === 'Busy').length;
      const unavailable = zoneTechs.filter((t) => t.availabilityStatus === 'Unavailable').length;
      const coveringAvailable = technicians.filter(
        (t) =>
          t.availabilityStatus === 'Available' &&
          (t.clusterZone === cluster.name || (t.preferredLocations || []).includes(cluster.name))
      ).length;
      const zoneBookings = bookings.filter((b) => b.clusterZone === cluster.name).length;

      return {
        name: cluster.name,
        district: getMumbaiDistrict(cluster.name),
        total: zoneTechs.length,
        available,
        coveringAvailable,
        busy,
        unavailable,
        bookings: zoneBookings,
        subZonesCount: cluster.subZonesCount,
        isCore: cluster.isCore,
      };
    });
  }, [orderedClusters, technicians, bookings]);

  const filteredBarData = useMemo(() => {
    if (selectedZone !== 'All') {
      return clusterChartData.filter((d) => d.name === selectedZone);
    }
    if (zoneScope === 'core8') {
      return clusterChartData.filter((d) => d.isCore);
    }
    if (zoneScope === 'All Mumbai') {
      return clusterChartData;
    }
    return clusterChartData.filter((d) => d.district === zoneScope);
  }, [clusterChartData, selectedZone, zoneScope]);

  const donutData = useMemo(() => {
    if (donutMode === 'availability') {
      const avail = technicians.filter((t) => t.availabilityStatus === 'Available').length;
      const busy = technicians.filter((t) => t.availabilityStatus === 'Busy').length;
      const off = technicians.filter((t) => t.availabilityStatus === 'Unavailable').length;
      return [
        { name: 'Available', value: avail, color: '#059669' },
        { name: 'Busy', value: busy, color: '#D97706' },
        { name: 'Unavailable', value: off, color: '#64748B' },
      ].filter((d) => d.value > 0);
    }

    return clusterChartData
      .filter((d) => d.total > 0)
      .map((d, idx) => ({
        name: d.name,
        value: d.total,
        color: CLUSTER_COLORS[idx % CLUSTER_COLORS.length],
      }));
  }, [donutMode, clusterChartData, technicians]);

  const totalTechs = technicians.length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-start gap-2.5">
          <BarChart3 className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Mumbai Service Cluster — Technician Density
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Colaba · Mahim · Bandra · Khar · Santacruz · Andheri · Jogeshwari · Borivali (
              <span className="font-mono tabular-nums font-medium text-slate-700">{totalTechs}</span> total technicians)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100">
            <button
              type="button"
              onClick={() => setChartView('density')}
              className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                chartView === 'density' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Technician Density
            </button>
            <button
              type="button"
              onClick={() => setChartView('stacked')}
              className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                chartView === 'stacked' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Availability Stack
            </button>
            <button
              type="button"
              onClick={() => setChartView('bookings')}
              className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                chartView === 'bookings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Supply vs Demand
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100">
            <button
              type="button"
              onClick={() => setZoneScope('core8')}
              className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                zoneScope === 'core8' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Core 8
            </button>
            {MUMBAI_DISTRICTS.map((dist) => (
              <button
                key={dist}
                type="button"
                onClick={() => setZoneScope(dist)}
                className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  zoneScope === dist ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {dist === 'All Mumbai' ? `All (${orderedClusters.length})` : dist}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100">
            <button
              type="button"
              onClick={() => setDonutMode('clusters')}
              className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                donutMode === 'clusters' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cluster Share
            </button>
            <button
              type="button"
              onClick={() => setDonutMode('availability')}
              className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                donutMode === 'availability' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Status Mix
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Primary Recharts Visualization across the 8 Mumbai Service Zones */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700">
              {chartView === 'density'
                ? 'Registered Technicians vs. Available Dispatch Density (including 3–10 km radius overlap)'
                : chartView === 'stacked'
                  ? 'Technicians per Mumbai Service Zone (Available / Busy / Unavailable)'
                  : 'Registered Technicians vs. Customer Service Bookings'}
            </span>
            {selectedZone !== 'All' && (
              <button
                type="button"
                onClick={() => onSelectZone('All')}
                className="text-amber-700 font-medium hover:underline whitespace-nowrap ml-2"
              >
                Show All 8+ Zones
              </button>
            )}
          </div>

          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={filteredBarData}
                margin={{ top: 10, right: 12, left: -16, bottom: 16 }}
                onClick={(state) => {
                  const label = state?.activeLabel;
                  if (typeof label === 'string' && label) {
                    onSelectZone(selectedZone === label ? 'All' : label);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                  interval={0}
                  angle={filteredBarData.length > 6 ? -20 : 0}
                  textAnchor={filteredBarData.length > 6 ? 'end' : 'middle'}
                  height={filteredBarData.length > 6 ? 50 : 30}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#F8FAFC' }}
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                  itemStyle={{ color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}
                  labelStyle={{ fontWeight: 600, marginBottom: '4px', color: '#F59E0B' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />

                {chartView === 'density' && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="coveringAvailable"
                      name="Dispatch Coverage (Available + Radius)"
                      fill="#D1FAE5"
                      stroke="#059669"
                      strokeWidth={2}
                    />
                    <Bar dataKey="total" name="Registered in Zone" fill="#0F172A" radius={[4, 4, 0, 0]} barSize={22} />
                    <Bar dataKey="available" name="Available in Zone" fill="#D97706" radius={[4, 4, 0, 0]} barSize={22} />
                  </>
                )}

                {chartView === 'stacked' && (
                  <>
                    <Bar dataKey="available" name="Available" stackId="techs" fill="#059669" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="busy" name="Busy" stackId="techs" fill="#D97706" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="unavailable" name="Unavailable" stackId="techs" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                  </>
                )}

                {chartView === 'bookings' && (
                  <>
                    <Bar dataKey="total" name="Total Technicians" fill="#0F172A" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="bookings" name="Bookings" fill="#D97706" radius={[4, 4, 0, 0]} />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart: Cluster Share or Availability Mix */}
        <div className="lg:col-span-5 space-y-3 border-t lg:border-t-0 lg:border-l border-slate-100 pt-5 lg:pt-0 lg:pl-6">
          <div className="text-xs font-medium text-slate-700">
            {donutMode === 'clusters'
              ? 'Technician Share Across Mumbai Clusters'
              : 'Citywide Availability Status Breakdown'}
          </div>

          {donutData.length === 0 ? (
            <div className="h-[320px] flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-6">
              <p className="text-sm font-medium text-slate-700">No technicians registered yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                All eight Mumbai service zones are initialized. As technicians register, proportional density across Colaba through Borivali will populate here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={86}
                      paddingAngle={2}
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                      itemStyle={{ color: '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {donutData.map((entry) => {
                  const pct = totalTechs > 0 ? Math.round((entry.value / totalTechs) * 100) : 0;
                  return (
                    <div key={entry.name} className="flex items-center justify-between gap-2 py-1 border-b border-slate-100">
                      <span className="inline-flex items-center gap-1.5 text-slate-700 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="truncate">{entry.name}</span>
                      </span>
                      <span className="font-mono tabular-nums font-medium text-slate-900 shrink-0">
                        {entry.value} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
