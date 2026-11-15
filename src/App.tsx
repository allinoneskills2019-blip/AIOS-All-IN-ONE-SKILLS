import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Building2, Globe, Home, Loader2, LocateFixed, LogOut, Search, ShieldCheck, ShoppingBag, ShoppingCart, User, Wrench, X } from 'lucide-react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { MarketplaceProvider, useMarketplace } from './context/MarketplaceContext';
import { useDeviceLocation } from './hooks/useDeviceLocation';
import { formatDistanceKm, getDistanceToZoneKm, getTechnicianDistanceFromOrigin } from './lib/geo';
import { translateAvailability, translateSkillCategory } from './lib/i18n';
import { MarketplaceHome, type MarketplaceFeed } from './components/MarketplaceHome';
import { ShopkeeperDashboard } from './components/ShopkeeperDashboard';
import { ContractorDashboard } from './components/ContractorDashboard';
import { TechnicianDashboard } from './components/TechnicianDashboard';
import { CustomerDashboard } from './components/CustomerDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallBanner';
import { CartDrawer } from './components/CartDrawer';
import { AIVoiceAssistant } from './components/AIVoiceAssistant';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import type { Product, TechnicianProfile, UserRole } from './types';

type AppView = 'marketplace' | 'shopkeeper' | 'contractor' | 'technician' | 'customer' | 'admin';

const AppShell: React.FC = () => {
  const { user, userAccount, isAdmin, zones, notifications, technicians, contractors, shops, products, cart, logout } =
    useMarketplace();
  const { language, setLanguage, t } = useLanguage();
  const zoneNames = useMemo(() => zones.map((z) => z.name), [zones]);
  const deviceLocation = useDeviceLocation(zoneNames);
  const [view, setView] = useState<AppView>('marketplace');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authDefaultRole, setAuthDefaultRole] = useState<UserRole>('customer');
  const [notifOpen, setNotifOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [selectedTech, setSelectedTech] = useState<TechnicianProfile | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Global Header Search & Voice Filter State
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [requestedFeed, setRequestedFeed] = useState<MarketplaceFeed>('technicians');
  const [voiceSkillFilter, setVoiceSkillFilter] = useState<string>('');
  const [voiceZoneFilter, setVoiceZoneFilter] = useState<string>('');
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const quickMatches = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) {
      return { techs: [], contractorsList: [], shopsList: [] };
    }

    const originCoords = deviceLocation.activeOriginCoords;

    const matchedTechs = technicians
      .filter(
        (t) =>
          t.fullName.toLowerCase().includes(q) ||
          t.skillCategory.toLowerCase().includes(q) ||
          (t.subcategory || '').toLowerCase().includes(q) ||
          t.clusterZone.toLowerCase().includes(q) ||
          (t.preferredLocations || []).some((loc) => loc.toLowerCase().includes(q))
      )
      .map((t) => ({
        item: t,
        distanceKm: originCoords
          ? getTechnicianDistanceFromOrigin(originCoords, t)?.distanceKm ?? null
          : null,
      }));

    if (originCoords) {
      matchedTechs.sort(
        (a, b) =>
          (a.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.distanceKm ?? Number.POSITIVE_INFINITY)
      );
    }

    const matchedContractors = contractors
      .filter(
        (c) =>
          c.companyName.toLowerCase().includes(q) ||
          c.contactName.toLowerCase().includes(q) ||
          (c.specialization || '').toLowerCase().includes(q) ||
          c.clusterZone.toLowerCase().includes(q)
      )
      .map((c) => ({
        item: c,
        distanceKm: originCoords ? getDistanceToZoneKm(originCoords, c.clusterZone) : null,
      }));

    if (originCoords) {
      matchedContractors.sort(
        (a, b) =>
          (a.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.distanceKm ?? Number.POSITIVE_INFINITY)
      );
    }

    const shopCategoriesMap = new Map<string, string[]>();
    products.forEach((p) => {
      const list = shopCategoriesMap.get(p.shopId) || [];
      if (!list.includes(p.category)) list.push(p.category);
      shopCategoriesMap.set(p.shopId, list);
    });

    const matchedShops = shops
      .filter((s) => {
        const cats = shopCategoriesMap.get(s.id) || [];
        return (
          s.shopName.toLowerCase().includes(q) ||
          s.ownerName.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q) ||
          s.clusterZone.toLowerCase().includes(q) ||
          cats.some((cat) => cat.toLowerCase().includes(q))
        );
      })
      .map((s) => ({
        item: s,
        distanceKm: originCoords ? getDistanceToZoneKm(originCoords, s.clusterZone) : null,
      }));

    if (originCoords) {
      matchedShops.sort(
        (a, b) =>
          (a.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.distanceKm ?? Number.POSITIVE_INFINITY)
      );
    }

    return {
      techs: matchedTechs.slice(0, 4),
      contractorsList: matchedContractors.slice(0, 4),
      shopsList: matchedShops.slice(0, 4),
    };
  }, [globalSearch, technicians, contractors, shops, products, deviceLocation.activeOriginCoords]);

  const totalQuickMatches =
    quickMatches.techs.length + quickMatches.contractorsList.length + quickMatches.shopsList.length;

  const jumpToMarketplaceFeed = (feed: MarketplaceFeed, overrideQuery?: string) => {
    if (typeof overrideQuery === 'string') {
      setGlobalSearch(overrideQuery);
    }
    setRequestedFeed(feed);
    setView('marketplace');
    setSearchFocused(false);
    setTimeout(() => {
      document.getElementById('marketplace-directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let targetFeed: MarketplaceFeed = requestedFeed;
    if (quickMatches.techs.length > 0) targetFeed = 'technicians';
    else if (quickMatches.contractorsList.length > 0) targetFeed = 'contractors';
    else if (quickMatches.shopsList.length > 0) targetFeed = 'shops';
    jumpToMarketplaceFeed(targetFeed);
  };

  const openPortal = (role: UserRole) => {
    setAuthDefaultRole(role);
    setView(role);
  };

  const handleBookTech = (tech: TechnicianProfile) => {
    setSelectedTech(tech);
    setView('customer');
    if (!user) {
      setAuthDefaultRole('customer');
      setAuthModalOpen(true);
    }
  };

  const handleOrderProd = (product: Product) => {
    setSelectedProduct(product);
    setView('customer');
    if (!user) {
      setAuthDefaultRole('customer');
      setAuthModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Strict Top Bar Header with Global Marketplace Search */}
      <header
        ref={searchContainerRef}
        className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 lg:gap-6">
          {/* Brand Wordmark */}
          <button
            type="button"
            onClick={() => setView('marketplace')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left"
          >
            All in One Skill
          </button>

          {/* Primary Navigation Links */}
          <nav className="hidden lg:flex items-center gap-4 xl:gap-5 text-sm font-medium text-slate-600 shrink-0">
            <button
              type="button"
              onClick={() => setView('marketplace')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                view === 'marketplace' ? 'text-slate-900 underline underline-offset-8 decoration-amber-600 decoration-2' : ''
              }`}
            >
              {t.header.navMarketplace}
            </button>
            <button
              type="button"
              onClick={() => setView('shopkeeper')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                view === 'shopkeeper' ? 'text-slate-900 underline underline-offset-8 decoration-amber-600 decoration-2' : ''
              }`}
            >
              {t.header.navShopkeepers}
            </button>
            <button
              type="button"
              onClick={() => setView('contractor')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                view === 'contractor' ? 'text-slate-900 underline underline-offset-8 decoration-amber-600 decoration-2' : ''
              }`}
            >
              {t.header.navContractors}
            </button>
            <button
              type="button"
              onClick={() => setView('technician')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                view === 'technician' ? 'text-slate-900 underline underline-offset-8 decoration-amber-600 decoration-2' : ''
              }`}
            >
              {t.header.navTechnicians}
            </button>
            <button
              type="button"
              onClick={() => setView('customer')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                view === 'customer' ? 'text-slate-900 underline underline-offset-8 decoration-amber-600 decoration-2' : ''
              }`}
            >
              {t.header.navCustomerHub}
            </button>
          </nav>

          {/* Global Marketplace Search Bar (Desktop & Tablet) */}
          <div className="hidden sm:block flex-1 max-w-sm lg:max-w-xs xl:max-w-sm relative">
            <form onSubmit={handleGlobalSearchSubmit} className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="search"
                value={globalSearch}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setSearchFocused(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchFocused(false);
                }}
                placeholder={t.header.searchPlaceholder}
                aria-label={t.header.searchAriaLabel}
                className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-slate-50/70 pl-9 pr-8 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  aria-label={t.header.clearSearch}
                  className="absolute right-2 p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {searchFocused && globalSearch.trim().length > 0 && (
              <div
                role="region"
                aria-label="Quick marketplace search matches"
                className="absolute left-0 right-0 top-full mt-1.5 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-50 max-h-[70vh] overflow-y-auto"
              >
                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      deviceLocation.status === 'active'
                        ? deviceLocation.clearLocation()
                        : deviceLocation.requestLocation()
                    }
                    disabled={deviceLocation.status === 'locating'}
                    className="inline-flex items-center gap-1.5 font-medium text-amber-700 hover:text-amber-800"
                  >
                    {deviceLocation.status === 'locating' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <LocateFixed className="w-3 h-3" />
                    )}
                    <span>
                      {deviceLocation.status === 'active' && deviceLocation.nearestZone
                        ? `${t.header.gpsClearPrefix} (${deviceLocation.nearestZone.zoneName}) · ${t.header.clear}`
                        : deviceLocation.status === 'locating'
                          ? t.header.detectingLocation
                          : t.header.sortByMyLocation}
                    </span>
                  </button>
                  {deviceLocation.activeOriginCoords && (
                    <span className="text-slate-500 font-mono">{t.header.nearestFirst}</span>
                  )}
                </div>

                {totalQuickMatches === 0 ? (
                  <div className="p-4 text-xs text-slate-500">
                    {t.header.noQuickMatches}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {quickMatches.techs.length > 0 && (
                      <div className="p-2.5 space-y-1">
                        <div className="px-2 text-[11px] font-semibold text-slate-500">
                          {t.header.quickTechnicians} ({quickMatches.techs.length})
                        </div>
                        {quickMatches.techs.map(({ item: tItem, distanceKm }) => (
                          <button
                            key={tItem.id}
                            type="button"
                            onClick={() => jumpToMarketplaceFeed('technicians', tItem.fullName)}
                            className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">{tItem.fullName}</div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {translateSkillCategory(tItem.skillCategory, language)} · {tItem.clusterZone}
                                {distanceKm !== null ? ` · ${formatDistanceKm(distanceKm)}` : ''}
                              </div>
                            </div>
                            <span className="text-[11px] font-medium text-amber-700 shrink-0">
                              {translateAvailability(tItem.availabilityStatus, language)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {quickMatches.contractorsList.length > 0 && (
                      <div className="p-2.5 space-y-1">
                        <div className="px-2 text-[11px] font-semibold text-slate-500">
                          {t.header.quickContractors} ({quickMatches.contractorsList.length})
                        </div>
                        {quickMatches.contractorsList.map(({ item: c, distanceKm }) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => jumpToMarketplaceFeed('contractors', c.companyName)}
                            className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">{c.companyName}</div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {c.specialization || t.header.roleContractor} · {c.clusterZone}
                                {distanceKm !== null ? ` · ${formatDistanceKm(distanceKm)}` : ''}
                              </div>
                            </div>
                            <span className="text-[11px] font-mono text-slate-500 shrink-0">{c.packageTier}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {quickMatches.shopsList.length > 0 && (
                      <div className="p-2.5 space-y-1">
                        <div className="px-2 text-[11px] font-semibold text-slate-500">
                          {t.header.quickShops} ({quickMatches.shopsList.length})
                        </div>
                        {quickMatches.shopsList.map(({ item: s, distanceKm }) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => jumpToMarketplaceFeed('shops', s.shopName)}
                            className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">{s.shopName}</div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {s.ownerName} · {s.clusterZone}
                                {distanceKm !== null ? ` · ${formatDistanceKm(distanceKm)}` : ''}
                              </div>
                            </div>
                            <span className="text-[11px] font-mono text-slate-500 shrink-0">{s.sellerPlan}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Primary Action & Marathi-English Language Toggle */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div
              role="group"
              aria-label={t.header.langToggleAria}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-100 p-0.5 shrink-0"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1 hidden xl:block shrink-0" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setLanguage('en')}
                aria-pressed={language === 'en'}
                className={`min-h-[34px] px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  language === 'en'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('mr')}
                aria-pressed={language === 'mr'}
                className={`min-h-[34px] px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  language === 'mr'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                मराठी
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={`Shopping cart (${cartCount} items)`}
              className="relative min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingCart className="w-4 h-4 text-amber-600" />
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span className="font-mono tabular-nums font-bold text-amber-700">({cartCount})</span>
              )}
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => setView(isAdmin ? 'admin' : userAccount?.role || 'customer')}
                className="min-h-[40px] px-3.5 sm:px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                {isAdmin ? t.header.adminConsole : t.header.myDashboard}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthDefaultRole('customer');
                  setAuthModalOpen(true);
                }}
                className="min-h-[40px] px-3.5 sm:px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                {t.header.signInOtp}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Global Search Bar Row */}
        <div className="sm:hidden border-t border-slate-100 px-4 py-2">
          <form onSubmit={handleGlobalSearchSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="search"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder={t.header.mobileSearchPlaceholder}
              aria-label="Mobile marketplace search"
              className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-slate-50/70 pl-9 pr-8 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-500 focus:outline-none"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                aria-label={t.header.clearSearch}
                className="absolute right-2 p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </div>
      </header>

      {/* Secondary Workspace Utility Bar */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-slate-500 whitespace-nowrap">{t.header.dashboardsLabel}</span>
            {(
              [
                ['customer', t.header.roleCustomer],
                ['shopkeeper', t.header.roleShopkeeper],
                ['contractor', t.header.roleContractor],
                ['technician', t.header.roleTechnician],
              ] as const
            ).map(([roleKey, roleLabel]) => (
              <button
                key={roleKey}
                type="button"
                onClick={() => setView(roleKey)}
                className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                  view === roleKey ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {roleLabel}
              </button>
            ))}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setView('admin')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                  view === 'admin' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> {t.header.masterAdmin}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton />
            {user && (
              <>
                <button
                  type="button"
                  onClick={() => setNotifOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-600" />
                  <span>{t.header.alerts}</span>
                  {unreadCount > 0 && (
                    <span className="font-mono font-semibold text-amber-700">({unreadCount})</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={logout}
                  aria-label={t.header.signOut}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.header.signOut}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-8 pb-24 md:pb-12">
        {view === 'marketplace' && (
          <MarketplaceHome
            globalSearch={globalSearch}
            onGlobalSearchChange={setGlobalSearch}
            requestedFeed={requestedFeed}
            onFeedChange={setRequestedFeed}
            externalSkillFilter={voiceSkillFilter}
            externalZoneFilter={voiceZoneFilter}
            deviceLocation={deviceLocation}
            onSelectCategoryPortal={openPortal}
            onBookTechnician={handleBookTech}
            onOrderProduct={handleOrderProd}
            onOpenCart={() => setCartOpen(true)}
            onRequireAuth={() => {
              setAuthDefaultRole('customer');
              setAuthModalOpen(true);
            }}
          />
        )}
        {view === 'shopkeeper' && (
          <ShopkeeperDashboard
            onRequireAuth={() => {
              setAuthDefaultRole('shopkeeper');
              setAuthModalOpen(true);
            }}
          />
        )}
        {view === 'contractor' && (
          <ContractorDashboard
            onRequireAuth={() => {
              setAuthDefaultRole('contractor');
              setAuthModalOpen(true);
            }}
          />
        )}
        {view === 'technician' && (
          <TechnicianDashboard
            deviceLocation={deviceLocation}
            onRequireAuth={() => {
              setAuthDefaultRole('technician');
              setAuthModalOpen(true);
            }}
          />
        )}
        {view === 'customer' && (
          <CustomerDashboard
            preselectedTech={selectedTech}
            preselectedProduct={selectedProduct}
            onOpenMarketplaceFeed={(feed, query) => jumpToMarketplaceFeed(feed, query)}
            onRequireAuth={() => {
              setAuthDefaultRole('customer');
              setAuthModalOpen(true);
            }}
          />
        )}
        {view === 'admin' && <AdminDashboard />}

        {/* Compact Mobile Privacy Policy Link above Mobile Nav Bar */}
        <div className="md:hidden pt-6 pb-2 flex items-center justify-between border-t border-slate-200 mt-8 text-xs text-slate-500">
          <span>All in One Skill © 2026</span>
          <button
            type="button"
            onClick={() => setPrivacyOpen(true)}
            className="font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
          >
            Privacy Policy
          </button>
        </div>
      </main>

      {/* Mobile Bottom Tab Bar (Thumb-zone navigation for Android PWA) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 h-16">
        {(
          [
            ['marketplace', t.header.mobileHome, Home],
            ['shopkeeper', t.header.mobileShops, ShoppingBag],
            ['contractor', t.header.mobileContract, Building2],
            ['technician', t.header.mobileTechs, Wrench],
            ['customer', t.header.mobileOrders, User],
          ] as const
        ).map(([key, label, Icon]) => {
          const active = view === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active ? 'text-amber-600' : 'text-slate-600'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Clean Footer */}
      <footer className="hidden md:block border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between gap-4 text-xs text-slate-500">
          <span>{t.header.footerLeft}</span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setPrivacyOpen(true)}
              className="font-medium text-slate-700 hover:text-slate-900 underline underline-offset-4"
            >
              Privacy Policy
            </button>
            <span>{t.header.footerRight}</span>
          </div>
        </div>
      </footer>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultRole={authDefaultRole}
      />
      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onRequireAuth={() => {
          setCartOpen(false);
          setAuthDefaultRole('customer');
          setAuthModalOpen(true);
        }}
        onCheckoutSuccess={() => setView('customer')}
      />
      <AIVoiceAssistant
        onApplySearch={({ skill, zone, feed }) => {
          if (skill) setVoiceSkillFilter(skill);
          if (zone) setVoiceZoneFilter(zone);
          jumpToMarketplaceFeed((feed as MarketplaceFeed) || 'technicians');
        }}
        onOpenBookingHelp={() => setView('customer')}
        onOpenCart={() => setCartOpen(true)}
      />
      <PrivacyPolicy open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <MarketplaceProvider>
        <AppShell />
      </MarketplaceProvider>
    </LanguageProvider>
  );
}
