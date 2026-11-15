import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { RefreshCw } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import type {
  ContractorProfile,
  ShopProfile,
  TechnicianProfile,
  UserAccount,
} from '../types';

interface DashboardOverviewCardProps {
  selectedZone?: string;
  onResetZone?: () => void;
}

export const DashboardOverviewCard: React.FC<DashboardOverviewCardProps> = ({
  selectedZone = 'All',
  onResetZone,
}) => {
  const { authReady, user, isAdmin } = useMarketplace();

  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [shopsList, setShopsList] = useState<ShopProfile[]>([]);
  const [contractorsList, setContractorsList] = useState<ContractorProfile[]>([]);
  const [techniciansList, setTechniciansList] = useState<TechnicianProfile[]>([]);

  const [loaded, setLoaded] = useState({
    users: false,
    shops: false,
    contractors: false,
    technicians: false,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [listenerVersion, setListenerVersion] = useState(0);

  useEffect(() => {
    if (!authReady || !user || !isAdmin) {
      return;
    }

    setErrorMsg(null);
    setLoaded({
      users: false,
      shops: false,
      contractors: false,
      technicians: false,
    });

    const unsubs: Array<() => void> = [];

    const onListenerError = (err: unknown, path: string) => {
      setErrorMsg(
        err instanceof Error ? err.message : `Unable to subscribe to ${path} collection.`
      );
      handleFirestoreError(err, OperationType.LIST, path);
    };

    unsubs.push(
      onSnapshot(
        collection(db, 'users'),
        (snap) => {
          setUsersList(snap.docs.map((d) => d.data() as UserAccount));
          setLoaded((prev) => ({ ...prev, users: true }));
          setLastSyncedAt(new Date());
        },
        (err) => onListenerError(err, 'users')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'shops'),
        (snap) => {
          setShopsList(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ShopProfile, 'id'>) }))
          );
          setLoaded((prev) => ({ ...prev, shops: true }));
          setLastSyncedAt(new Date());
        },
        (err) => onListenerError(err, 'shops')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'contractors'),
        (snap) => {
          setContractorsList(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ContractorProfile, 'id'>),
            }))
          );
          setLoaded((prev) => ({ ...prev, contractors: true }));
          setLastSyncedAt(new Date());
        },
        (err) => onListenerError(err, 'contractors')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'technicians'),
        (snap) => {
          setTechniciansList(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<TechnicianProfile, 'id'>),
            }))
          );
          setLoaded((prev) => ({ ...prev, technicians: true }));
          setLastSyncedAt(new Date());
        },
        (err) => onListenerError(err, 'technicians')
      )
    );

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [authReady, user, isAdmin, listenerVersion]);

  const isLoading =
    !loaded.users || !loaded.shops || !loaded.contractors || !loaded.technicians;

  const stats = useMemo(() => {
    const isFiltered = selectedZone && selectedZone !== 'All';

    const scopedUsers = isFiltered
      ? usersList.filter((u) => u.clusterZone === selectedZone)
      : usersList;
    const scopedShops = isFiltered
      ? shopsList.filter((s) => s.clusterZone === selectedZone)
      : shopsList;
    const scopedContractors = isFiltered
      ? contractorsList.filter((c) => c.clusterZone === selectedZone)
      : contractorsList;
    const scopedTechs = isFiltered
      ? techniciansList.filter((t) => t.clusterZone === selectedZone)
      : techniciansList;

    return {
      isFiltered,
      users: {
        total: usersList.length,
        scoped: scopedUsers.length,
        customers: usersList.filter((u) => u.role === 'customer').length,
        otpVerified: usersList.filter((u) => u.phoneVerified).length,
      },
      shopkeepers: {
        total: shopsList.length,
        scoped: scopedShops.length,
        verified: shopsList.filter((s) => s.verified).length,
        pending: shopsList.filter((s) => !s.verified).length,
      },
      contractors: {
        total: contractorsList.length,
        scoped: scopedContractors.length,
        verified: contractorsList.filter((c) => c.verified).length,
        subscribed: contractorsList.filter((c) => c.packageTier !== 'None').length,
      },
      technicians: {
        total: techniciansList.length,
        scoped: scopedTechs.length,
        available: techniciansList.filter((t) => t.availabilityStatus === 'Available').length,
        busy: techniciansList.filter((t) => t.availabilityStatus === 'Busy').length,
      },
    };
  }, [usersList, shopsList, contractorsList, techniciansList, selectedZone]);

  const formattedSyncTime = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Connecting';

  const items = [
    {
      key: 'users',
      label: 'Total Users',
      collectionName: 'users',
      value: stats.users.total,
      scopedValue: stats.users.scoped,
      detail: `${stats.users.customers} customers · ${stats.users.otpVerified} OTP verified`,
    },
    {
      key: 'shopkeepers',
      label: 'Shopkeepers',
      collectionName: 'shops',
      value: stats.shopkeepers.total,
      scopedValue: stats.shopkeepers.scoped,
      detail: `${stats.shopkeepers.verified} verified · ${stats.shopkeepers.pending} pending`,
    },
    {
      key: 'contractors',
      label: 'Contractors',
      collectionName: 'contractors',
      value: stats.contractors.total,
      scopedValue: stats.contractors.scoped,
      detail: `${stats.contractors.verified} verified · ${stats.contractors.subscribed} subscribed`,
    },
    {
      key: 'technicians',
      label: 'Technicians',
      collectionName: 'technicians',
      value: stats.technicians.total,
      scopedValue: stats.technicians.scoped,
      detail: `${stats.technicians.available} available · ${stats.technicians.busy} busy`,
    },
  ];

  return (
    <section
      aria-label="Dashboard Overview"
      className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Dashboard Overview</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time Firestore counts across users, shops, contractors, and technicians
            {stats.isFiltered ? ` · Highlighting ${selectedZone}` : ' · All Mumbai Clusters'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {stats.isFiltered && onResetZone && (
            <button
              type="button"
              onClick={onResetZone}
              className="text-amber-700 font-medium hover:underline whitespace-nowrap shrink-0"
            >
              Clear {selectedZone} filter
            </button>
          )}
          <span className="font-mono tabular-nums whitespace-nowrap">
            Synced {formattedSyncTime}
          </span>
          <button
            type="button"
            onClick={() => setListenerVersion((v) => v + 1)}
            className="inline-flex items-center gap-1.5 min-h-[34px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setListenerVersion((v) => v + 1)}
            className="font-medium text-red-900 underline whitespace-nowrap shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading && !errorMsg ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x divide-slate-100">
          {items.map((item) => (
            <div
              key={item.key}
              className="lg:px-5 first:lg:pl-0 last:lg:pr-0 space-y-2.5"
            >
              <div className="h-3.5 w-24 rounded bg-slate-100 animate-pulse" />
              <div className="h-8 w-16 rounded bg-slate-100 animate-pulse" />
              <div className="h-3 w-40 rounded bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x divide-slate-100">
          {items.map((item) => (
            <div
              key={item.key}
              className="lg:px-5 first:lg:pl-0 last:lg:pr-0"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">{item.label}</span>
                <span className="text-[11px] font-mono text-slate-400">
                  {item.collectionName}
                </span>
              </div>

              <div className="mt-1.5 flex items-baseline gap-2.5">
                <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
                  {item.value.toLocaleString('en-IN')}
                </span>
                {stats.isFiltered && (
                  <span className="text-xs font-mono tabular-nums text-amber-700 font-medium">
                    ({item.scopedValue.toLocaleString('en-IN')} in {selectedZone})
                  </span>
                )}
              </div>

              <p className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
