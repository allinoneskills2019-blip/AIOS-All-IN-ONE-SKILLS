import React from 'react';

export const KpiStripSkeleton: React.FC = () => (
  <section
    aria-label="Loading marketplace metrics"
    className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-y border-slate-200 py-6 animate-pulse"
  >
    {[0, 1, 2, 3].map((idx) => (
      <div key={idx} className="space-y-2">
        <div className="h-7 w-16 rounded-md bg-slate-200" />
        <div className="h-3.5 w-32 rounded bg-slate-200/80" />
      </div>
    ))}
  </section>
);

export const TechnicianCardSkeleton: React.FC = () => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 animate-pulse">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-lg bg-slate-200 shrink-0" />
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-slate-200" />
          <div className="h-4 w-36 rounded bg-slate-200" />
        </div>
      </div>
      <div className="h-6 w-16 rounded-md bg-slate-200" />
    </div>
    <div className="space-y-2">
      <div className="h-3 w-48 rounded bg-slate-200/80" />
      <div className="h-3 w-full rounded bg-slate-200/70" />
      <div className="h-3 w-3/4 rounded bg-slate-200/70" />
    </div>
    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
      <div className="h-5 w-20 rounded bg-slate-200" />
      <div className="h-9 w-28 rounded-lg bg-slate-200" />
    </div>
  </div>
);

export const MarketplaceFeedSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div
    role="status"
    aria-label="Loading marketplace listings"
    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
  >
    {Array.from({ length: count }).map((_, idx) => (
      <TechnicianCardSkeleton key={idx} />
    ))}
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div role="status" aria-label="Loading dashboard workspace" className="space-y-6 animate-pulse">
    <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-2">
        <div className="h-6 w-56 rounded bg-slate-200" />
        <div className="h-3.5 w-72 max-w-full rounded bg-slate-200/80" />
      </div>
      <div className="h-10 w-36 rounded-lg bg-slate-200 shrink-0" />
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="h-7 w-20 rounded bg-slate-200" />
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <div className="h-5 w-44 rounded bg-slate-200" />
        <div className="h-24 w-full rounded-lg bg-slate-100" />
        <div className="h-24 w-full rounded-lg bg-slate-100" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <div className="h-5 w-48 rounded bg-slate-200" />
        <div className="h-24 w-full rounded-lg bg-slate-100" />
        <div className="h-24 w-full rounded-lg bg-slate-100" />
      </div>
    </div>
  </div>
);
