import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpDown,
  Bookmark,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  Hammer,
  Loader2,
  LocateFixed,
  MapPin,
  MessageSquare,
  Navigation,
  RefreshCw,
  Search,
  ShoppingBag,
  ShoppingCart,
  Star,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { type DeviceLocationState, useDeviceLocation } from '../hooks/useDeviceLocation';
import { findNextFreeSlot, formatSlotDisplay } from '../lib/availability';
import {
  AUTOMOTIVE_SUBCATEGORIES,
  formatINR,
  getExperienceCategory,
  PRODUCT_CATEGORIES,
  SKILL_CATEGORIES,
  SKILL_SEARCH_SYNONYMS,
} from '../lib/constants';
import { computeAiRecommendedTechnicians } from '../lib/recommendations';
import {
  DISTANCE_FILTER_OPTIONS,
  type DistanceLimitOption,
  formatDistanceKm,
  getDistanceToZoneKm,
  getTechnicianDistanceFromOrigin,
  getZoneCoords,
} from '../lib/geo';
import { translateAvailability, translateProductCategory, translateSkillCategory } from '../lib/i18n';
import type { Product, SavedFavoriteType, TechnicianProfile, TechnicianReview, UserRole } from '../types';

import heroImg from '../assets/images/hero_mumbai_workforce_1794641324980.jpg';
import shopImg from '../assets/images/category_shopkeeper_hardware_1794641325567.jpg';
import contractorImg from '../assets/images/category_contractor_site_1794641326319.jpg';
import techImg from '../assets/images/category_technician_service_1794641327943.jpg';

export type MarketplaceFeed = 'technicians' | 'contractors' | 'shops' | 'products' | 'projects';

interface MarketplaceHomeProps {
  globalSearch?: string;
  onGlobalSearchChange?: (value: string) => void;
  requestedFeed?: MarketplaceFeed;
  onFeedChange?: (feed: MarketplaceFeed) => void;
  externalSkillFilter?: string;
  externalZoneFilter?: string;
  deviceLocation?: DeviceLocationState;
  onSelectCategoryPortal: (role: UserRole) => void;
  onBookTechnician: (tech: TechnicianProfile) => void;
  onOrderProduct: (product: Product) => void;
  onOpenCart?: () => void;
  onRequireAuth?: () => void;
}

export const MarketplaceHome: React.FC<MarketplaceHomeProps> = ({
  globalSearch,
  onGlobalSearchChange,
  requestedFeed,
  onFeedChange,
  externalSkillFilter,
  externalZoneFilter,
  deviceLocation: externalLocation,
  onSelectCategoryPortal,
  onBookTechnician,
  onOrderProduct,
  onOpenCart,
  onRequireAuth,
}) => {
  const {
    user,
    userAccount,
    zones,
    technicians,
    bookings,
    technicianReviews,
    savedFavorites,
    shops,
    products,
    contractors,
    projects,
    toggleFavorite,
    addToCart,
  } = useMarketplace();
  const { language, t } = useLanguage();
  const zoneNames = useMemo(() => zones.map((z) => z.name), [zones]);
  const fallbackLocation = useDeviceLocation(zoneNames);
  const location = externalLocation || fallbackLocation;

  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [distanceLimit, setDistanceLimit] = useState<DistanceLimitOption>('all');
  const [sortByNearest, setSortByNearest] = useState<boolean>(true);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string>('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'A' | 'B' | 'C'>('All');
  const [selectedProdCat, setSelectedProdCat] = useState<string>('All');
  const [localFeed, setLocalFeed] = useState<MarketplaceFeed>('technicians');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [reviewsModalTech, setReviewsModalTech] = useState<TechnicianProfile | null>(null);
  const [aiReasonsMap, setAiReasonsMap] = useState<Record<string, string>>({});
  const [aiRefreshing, setAiRefreshing] = useState(false);

  useEffect(() => {
    if (externalSkillFilter) {
      setSelectedSkill(externalSkillFilter);
      setSelectedSubcategory('All');
    }
  }, [externalSkillFilter]);

  useEffect(() => {
    if (externalZoneFilter) {
      setSelectedZone(externalZoneFilter);
    }
  }, [externalZoneFilter]);

  const savedSet = useMemo(
    () => new Set(savedFavorites.map((f) => `${f.targetType}_${f.targetId}`)),
    [savedFavorites]
  );

  const handleBookmarkClick = async (item: {
    targetType: SavedFavoriteType;
    targetId: string;
    targetName: string;
    category?: string;
    clusterZone: string;
  }) => {
    if (!user) {
      onRequireAuth?.();
      return;
    }
    await toggleFavorite(item);
  };

  const reviewsByTech = useMemo(() => {
    const map = new Map<string, TechnicianReview[]>();
    for (const review of technicianReviews) {
      const list = map.get(review.technicianId) || [];
      list.push(review);
      map.set(review.technicianId, list);
    }
    return map;
  }, [technicianReviews]);

  const searchTerm = globalSearch !== undefined ? globalSearch : localSearchTerm;
  const setSearchTerm = (val: string) => {
    if (onGlobalSearchChange) onGlobalSearchChange(val);
    else setLocalSearchTerm(val);
  };

  const activeFeed = requestedFeed !== undefined ? requestedFeed : localFeed;
  const setActiveFeed = (feed: MarketplaceFeed) => {
    if (onFeedChange) onFeedChange(feed);
    else setLocalFeed(feed);
  };

  const markImgErr = (key: string) => setImgErrors((prev) => ({ ...prev, [key]: true }));

  const distanceContext = useMemo(() => {
    if (location.activeOriginCoords) {
      return {
        originCoords: location.activeOriginCoords,
        originSource: 'gps' as const,
        originLabel: location.activeOriginLabel || 'Current Location',
      };
    }
    if (selectedZone !== 'All') {
      const zoneCoords = getZoneCoords(selectedZone);
      if (zoneCoords) {
        return {
          originCoords: zoneCoords,
          originSource: 'zone' as const,
          originLabel: selectedZone,
        };
      }
    }
    return null;
  }, [location.activeOriginCoords, location.activeOriginLabel, selectedZone]);

  const maxDistKm = distanceLimit === 'all' ? null : Number(distanceLimit);

  const handleDistanceChange = (nextVal: DistanceLimitOption) => {
    setDistanceLimit(nextVal);
    if (nextVal !== 'all') {
      setSortByNearest(true);
      if (location.status !== 'active' && selectedZone === 'All') {
        location.requestLocation();
      }
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedZone('All');
    setDistanceLimit('all');
    location.clearLocation();
  };

  const userCustomerBookings = useMemo(
    () => (user ? bookings.filter((b) => b.customerId === user.uid) : []),
    [bookings, user]
  );

  const recommendationOrigin = useMemo(() => {
    if (distanceContext) {
      return {
        coords: distanceContext.originCoords,
        zone: location.nearestZone?.zoneName || (selectedZone !== 'All' ? selectedZone : distanceContext.originLabel),
        sourceLabel: distanceContext.originLabel,
        hasExplicitLocation: true,
      };
    }
    if (userAccount?.clusterZone) {
      return {
        coords: getZoneCoords(userAccount.clusterZone),
        zone: userAccount.clusterZone,
        sourceLabel: userAccount.clusterZone,
        hasExplicitLocation: true,
      };
    }
    return {
      coords: null,
      zone: null,
      sourceLabel: null,
      hasExplicitLocation: false,
    };
  }, [distanceContext, location.nearestZone?.zoneName, selectedZone, userAccount?.clusterZone]);

  const userBookedSkillsList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of userCustomerBookings) {
      if (b.status !== 'Cancelled' && b.status !== 'Rejected' && b.skillCategory) {
        counts.set(b.skillCategory, (counts.get(b.skillCategory) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([skill]) => skill);
  }, [userCustomerBookings]);

  const aiRecommendedPicks = useMemo(
    () =>
      computeAiRecommendedTechnicians({
        technicians,
        userBookings: userCustomerBookings,
        originCoords: recommendationOrigin.coords,
        originZone: recommendationOrigin.zone,
        limit: 3,
      }),
    [technicians, userCustomerBookings, recommendationOrigin.coords, recommendationOrigin.zone]
  );

  const handleRefreshAiPicks = async () => {
    if (aiRecommendedPicks.length === 0) return;
    setAiRefreshing(true);
    try {
      const res = await fetch('/api/ai/recommend-technicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originZone: recommendationOrigin.zone || 'Mumbai',
          bookedSkills: userBookedSkillsList,
          candidates: aiRecommendedPicks.map((item) => ({
            id: item.tech.id,
            fullName: item.tech.fullName,
            skillCategory: item.tech.skillCategory,
            clusterZone: item.tech.clusterZone,
            distanceKm: item.distanceKm,
            withinServiceRadius: item.withinServiceRadius,
            ratingAvg: item.tech.ratingAvg ?? 0,
            experienceYears: item.tech.experienceYears,
          })),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { reasons?: Record<string, string> };
        if (data.reasons) {
          setAiReasonsMap(data.reasons);
        }
      }
    } catch {
      // Keep deterministic reasons seamlessly on network/offline failure
    } finally {
      setAiRefreshing(false);
    }
  };

  const filteredTechs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const mapped = technicians
      .map((t) => {
        const distInfo = distanceContext
          ? getTechnicianDistanceFromOrigin(distanceContext.originCoords, t)
          : null;
        return { tech: t, distInfo };
      })
      .filter(({ tech: t, distInfo }) => {
        const useRadiusOverExactZone =
          distanceContext?.originSource === 'zone' && maxDistKm !== null;

        const zoneOk =
          useRadiusOverExactZone ||
          selectedZone === 'All' ||
          t.clusterZone === selectedZone ||
          (t.preferredLocations || []).includes(selectedZone);

        const distOk =
          maxDistKm === null ||
          distanceContext === null ||
          (distInfo !== null && distInfo.distanceKm <= maxDistKm);

        const skillOk = selectedSkill === 'All' || t.skillCategory === selectedSkill;
        const subcatOk =
          selectedSubcategory === 'All' ||
          (t.subcategory || '').toLowerCase() === selectedSubcategory.toLowerCase();
        const techTier =
          t.adminGrade && t.adminGrade !== 'Pending'
            ? t.adminGrade
            : t.experienceCategory || getExperienceCategory(t.experienceYears);
        const catOk = selectedCategory === 'All' || techTier === selectedCategory;
        const translatedSkill = translateSkillCategory(t.skillCategory, 'mr').toLowerCase();
        const skillSynonyms = SKILL_SEARCH_SYNONYMS[t.skillCategory] || [];
        const qOk =
          !q ||
          t.fullName.toLowerCase().includes(q) ||
          t.skillCategory.toLowerCase().includes(q) ||
          translatedSkill.includes(q) ||
          skillSynonyms.some((syn) => syn.toLowerCase().includes(q)) ||
          (t.subcategory || '').toLowerCase().includes(q) ||
          t.clusterZone.toLowerCase().includes(q) ||
          (t.preferredLocations || []).some((loc) => loc.toLowerCase().includes(q));
        return zoneOk && distOk && skillOk && subcatOk && catOk && qOk;
      });

    if (distanceContext && sortByNearest) {
      mapped.sort((a, b) => {
        const da = a.distInfo?.distanceKm ?? Number.POSITIVE_INFINITY;
        const db = b.distInfo?.distanceKm ?? Number.POSITIVE_INFINITY;
        return da - db;
      });
    }

    return mapped;
  }, [
    technicians,
    distanceContext,
    maxDistKm,
    sortByNearest,
    selectedZone,
    selectedSkill,
    selectedSubcategory,
    selectedCategory,
    searchTerm,
  ]);

  const filteredContractors = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const mapped = contractors
      .map((c) => ({
        contractor: c,
        distanceKm: distanceContext
          ? getDistanceToZoneKm(distanceContext.originCoords, c.clusterZone)
          : null,
      }))
      .filter(({ contractor: c, distanceKm }) => {
        const useRadiusOverExactZone =
          distanceContext?.originSource === 'zone' && maxDistKm !== null;
        const zoneOk =
          useRadiusOverExactZone || selectedZone === 'All' || c.clusterZone === selectedZone;
        const distOk =
          maxDistKm === null ||
          distanceContext === null ||
          (distanceKm !== null && distanceKm <= maxDistKm);
        const contractorProjects = projects.filter((pr) => pr.contractorId === c.ownerId);
        const qOk =
          !q ||
          c.companyName.toLowerCase().includes(q) ||
          c.contactName.toLowerCase().includes(q) ||
          (c.specialization || '').toLowerCase().includes(q) ||
          c.clusterZone.toLowerCase().includes(q) ||
          c.packageTier.toLowerCase().includes(q) ||
          contractorProjects.some(
            (pr) =>
              pr.title.toLowerCase().includes(q) ||
              pr.requiredSkill.toLowerCase().includes(q) ||
              pr.clusterZone.toLowerCase().includes(q)
          );
        return zoneOk && distOk && qOk;
      });

    if (distanceContext && sortByNearest) {
      mapped.sort(
        (a, b) =>
          (a.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.distanceKm ?? Number.POSITIVE_INFINITY)
      );
    }

    return mapped;
  }, [contractors, projects, distanceContext, maxDistKm, sortByNearest, selectedZone, searchTerm]);

  const filteredShops = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const mapped = shops
      .map((s) => ({
        shop: s,
        distanceKm: distanceContext
          ? getDistanceToZoneKm(distanceContext.originCoords, s.clusterZone)
          : null,
      }))
      .filter(({ shop: s, distanceKm }) => {
        const useRadiusOverExactZone =
          distanceContext?.originSource === 'zone' && maxDistKm !== null;
        const zoneOk =
          useRadiusOverExactZone || selectedZone === 'All' || s.clusterZone === selectedZone;
        const distOk =
          maxDistKm === null ||
          distanceContext === null ||
          (distanceKm !== null && distanceKm <= maxDistKm);
        const shopProducts = products.filter((p) => p.shopId === s.id);
        const qOk =
          !q ||
          s.shopName.toLowerCase().includes(q) ||
          s.ownerName.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q) ||
          s.clusterZone.toLowerCase().includes(q) ||
          s.sellerPlan.toLowerCase().includes(q) ||
          shopProducts.some(
            (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
          );
        return zoneOk && distOk && qOk;
      });

    if (distanceContext && sortByNearest) {
      mapped.sort(
        (a, b) =>
          (a.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.distanceKm ?? Number.POSITIVE_INFINITY)
      );
    }

    return mapped;
  }, [shops, products, distanceContext, maxDistKm, sortByNearest, selectedZone, searchTerm]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const mapped = products
      .map((p) => ({
        product: p,
        distanceKm: distanceContext
          ? getDistanceToZoneKm(distanceContext.originCoords, p.clusterZone)
          : null,
      }))
      .filter(({ product: p, distanceKm }) => {
        const useRadiusOverExactZone =
          distanceContext?.originSource === 'zone' && maxDistKm !== null;
        const zoneOk =
          useRadiusOverExactZone || selectedZone === 'All' || p.clusterZone === selectedZone;
        const distOk =
          maxDistKm === null ||
          distanceContext === null ||
          (distanceKm !== null && distanceKm <= maxDistKm);
        const catOk = selectedProdCat === 'All' || p.category === selectedProdCat;
        const translatedProdCat = translateProductCategory(p.category, 'mr').toLowerCase();
        const qOk =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          translatedProdCat.includes(q) ||
          p.shopName.toLowerCase().includes(q) ||
          p.clusterZone.toLowerCase().includes(q);
        return zoneOk && distOk && catOk && qOk;
      });

    if (distanceContext && sortByNearest) {
      mapped.sort((a, b) => {
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
        if (Math.abs(da - db) > 0.05) return da - db;
        return Number(b.product.isPromoted) - Number(a.product.isPromoted);
      });
    } else {
      mapped.sort((a, b) => Number(b.product.isPromoted) - Number(a.product.isPromoted));
    }

    return mapped;
  }, [products, distanceContext, maxDistKm, sortByNearest, selectedZone, selectedProdCat, searchTerm]);

  const filteredProjects = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const mapped = projects
      .map((pr) => ({
        project: pr,
        distanceKm: distanceContext
          ? getDistanceToZoneKm(distanceContext.originCoords, pr.clusterZone)
          : null,
      }))
      .filter(({ project: pr, distanceKm }) => {
        const useRadiusOverExactZone =
          distanceContext?.originSource === 'zone' && maxDistKm !== null;
        const zoneOk =
          useRadiusOverExactZone || selectedZone === 'All' || pr.clusterZone === selectedZone;
        const distOk =
          maxDistKm === null ||
          distanceContext === null ||
          (distanceKm !== null && distanceKm <= maxDistKm);
        const qOk =
          !q ||
          pr.title.toLowerCase().includes(q) ||
          pr.requiredSkill.toLowerCase().includes(q) ||
          pr.companyName.toLowerCase().includes(q) ||
          pr.clusterZone.toLowerCase().includes(q);
        return zoneOk && distOk && qOk;
      });

    if (distanceContext && sortByNearest) {
      mapped.sort(
        (a, b) =>
          (a.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.distanceKm ?? Number.POSITIVE_INFINITY)
      );
    }

    return mapped;
  }, [projects, distanceContext, maxDistKm, sortByNearest, selectedZone, searchTerm]);

  return (
    <div className="space-y-12 pb-12">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
          <div className="text-xs font-medium text-amber-700 tracking-wide">
            {t.marketplace.heroEyebrow}
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.1] max-w-2xl text-balance">
            {t.marketplace.heroTitle}
          </h1>
          <p className="text-base text-slate-600 max-w-xl leading-relaxed">
            {t.marketplace.heroSubtitle}
          </p>

          {/* Search, Mumbai Zone & Device Geolocation Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-2 space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t.marketplace.heroSearchPlaceholder}
                  className="w-full min-h-[44px] pl-9 pr-8 text-sm text-slate-900 bg-transparent focus:outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label={t.header.clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-2">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0 ml-1" />
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  aria-label="Filter by Mumbai cluster zone"
                  className="min-h-[44px] bg-transparent pr-2 text-sm font-medium text-slate-800 focus:outline-none max-w-[175px]"
                >
                  <option value="All">{t.common.allMumbaiZones}</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.name}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (location.status === 'active') {
                      location.requestLocation();
                    } else {
                      location.requestLocation();
                      setSortByNearest(true);
                    }
                  }}
                  disabled={location.status === 'locating'}
                  aria-pressed={location.status === 'active'}
                  className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    location.status === 'active'
                      ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                      : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {location.status === 'locating' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />
                  ) : (
                    <LocateFixed
                      className={`w-3.5 h-3.5 shrink-0 ${
                        location.status === 'active' ? 'text-amber-600' : 'text-slate-600'
                      }`}
                    />
                  )}
                  <span>
                    {location.status === 'locating'
                      ? t.marketplace.locating
                      : location.status === 'active' && location.nearestZone
                        ? `${t.marketplace.nearPrefix} ${location.nearestZone.zoneName}`
                        : t.marketplace.useMyLocation}
                  </span>
                </button>
                {location.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => location.clearLocation()}
                    aria-label={t.header.clear}
                    className="min-h-[44px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Distance Radius & Geolocation Status Row */}
            <div className="border-t border-slate-100 pt-2 px-1 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-slate-600">
                  <Navigation className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="whitespace-nowrap">{t.marketplace.radiusLabel}</span>
                  <select
                    value={distanceLimit}
                    onChange={(e) => handleDistanceChange(e.target.value as DistanceLimitOption)}
                    aria-label="Filter results by distance in kilometers"
                    className="min-h-[36px] rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-400"
                  >
                    {DISTANCE_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value === 'all'
                          ? t.marketplace.distanceAll
                          : `${t.marketplace.distanceWithinPrefix} ${opt.value} km`}
                      </option>
                    ))}
                  </select>
                </label>

                {distanceContext && (
                  <button
                    type="button"
                    onClick={() => setSortByNearest((prev) => !prev)}
                    aria-pressed={sortByNearest}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      sortByNearest
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>{sortByNearest ? t.marketplace.sortedNearest : t.marketplace.sortNearest}</span>
                  </button>
                )}
              </div>

              <div className="text-[11px] text-slate-500 font-mono tabular-nums flex flex-wrap items-center gap-2">
                {location.status === 'active' && location.rawCoords ? (
                  <>
                    <span className="text-slate-700">
                      GPS {location.rawCoords.lat.toFixed(4)}°N, {location.rawCoords.lng.toFixed(4)}°E
                      {location.nearestZone ? ` · ${location.nearestZone.zoneName}` : ''}
                    </span>
                    {location.isOutsideMumbai && location.nearestZone && (
                      <button
                        type="button"
                        onClick={() => location.setUseMumbaiAnchor(!location.usingMumbaiAnchor)}
                        className="font-sans font-medium text-amber-700 hover:text-amber-800 underline underline-offset-2"
                      >
                        {location.usingMumbaiAnchor
                          ? t.marketplace.useRawGps
                          : `${t.marketplace.measureFromPrefix} ${location.nearestZone.zoneName}`}
                      </button>
                    )}
                  </>
                ) : location.status === 'error' && location.errorMessage ? (
                  <span className="font-sans text-red-700 flex flex-wrap items-center gap-2">
                    <span>{location.errorMessage}</span>
                    <select
                      aria-label="Select fallback Mumbai zone"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          location.selectFallbackZone(e.target.value);
                          setSelectedZone(e.target.value);
                        }
                      }}
                      className="rounded-md border border-red-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-800"
                    >
                      <option value="">Set Mumbai zone manually...</option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.name}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => location.clearLocation()}
                      className="underline text-slate-600 hover:text-slate-900 shrink-0"
                    >
                      {t.common.dismiss}
                    </button>
                  </span>
                ) : selectedZone !== 'All' && maxDistKm !== null ? (
                  <span className="font-sans text-slate-600">
                    {t.marketplace.showingWithinPrefix} {maxDistKm} km · {t.marketplace.showingOfPrefix} {selectedZone}
                  </span>
                ) : (
                  <span className="font-sans text-slate-500">
                    {t.marketplace.gpsHint}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="relative h-full min-h-[280px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
            {!imgErrors.hero ? (
              <img
                src={heroImg}
                alt="Mumbai construction supervisor and electrical technician reviewing site plans"
                referrerPolicy="no-referrer"
                onError={() => markImgErr('hero')}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-300 p-8 text-center">
                <Hammer className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent p-5 text-white">
              <p className="text-xs text-amber-300 font-medium">{t.marketplace.liveCoverageLabel}</p>
              <p className="text-sm font-medium mt-0.5">
                Colaba · Mahim · Bandra · Khar · Santacruz · Andheri · Jogeshwari · Borivali
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Full-width KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-y border-slate-200 py-6">
        <div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">{technicians.length}</div>
          <div className="text-xs text-slate-500 mt-1">{t.marketplace.kpiTechnicians}</div>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">{products.length}</div>
          <div className="text-xs text-slate-500 mt-1">{t.marketplace.kpiProducts}</div>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">{contractors.length}</div>
          <div className="text-xs text-slate-500 mt-1">{t.marketplace.kpiContractors}</div>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">{zones.length}</div>
          <div className="text-xs text-slate-500 mt-1">{t.marketplace.kpiClusters}</div>
        </div>
      </section>

      {/* Three Core Preserved Categories */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t.marketplace.portalsTitle}</h2>
            <p className="text-sm text-slate-600 mt-1">
              {t.marketplace.portalsSubtitle}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Shopkeeper */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col">
            <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
              {!imgErrors.shop ? (
                <img
                  src={shopImg}
                  alt="Mumbai hardware and electrical supply store counter"
                  referrerPolicy="no-referrer"
                  onError={() => markImgErr('shop')}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <ShoppingBag className="w-10 h-10" />
                </div>
              )}
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <div className="text-xs text-slate-500">{t.marketplace.portal1Eyebrow}</div>
                <h3 className="text-lg font-semibold text-slate-900 mt-1">{t.marketplace.portal1Title}</h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  {t.marketplace.portal1Desc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectCategoryPortal('shopkeeper')}
                className="min-h-[44px] w-full flex items-center justify-between rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"
              >
                <span>{t.marketplace.portal1Cta}</span>
                <ArrowRight className="w-4 h-4 text-amber-600" />
              </button>
            </div>
          </div>

          {/* 2. Contractor */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col">
            <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
              {!imgErrors.contractor ? (
                <img
                  src={contractorImg}
                  alt="Mumbai residential construction and carpentry site"
                  referrerPolicy="no-referrer"
                  onError={() => markImgErr('contractor')}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <Building2 className="w-10 h-10" />
                </div>
              )}
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <div className="text-xs text-slate-500">{t.marketplace.portal2Eyebrow}</div>
                <h3 className="text-lg font-semibold text-slate-900 mt-1">{t.marketplace.portal2Title}</h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  {t.marketplace.portal2Desc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectCategoryPortal('contractor')}
                className="min-h-[44px] w-full flex items-center justify-between rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"
              >
                <span>{t.marketplace.portal2Cta}</span>
                <ArrowRight className="w-4 h-4 text-amber-600" />
              </button>
            </div>
          </div>

          {/* 3. Technician */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col">
            <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
              {!imgErrors.tech ? (
                <img
                  src={techImg}
                  alt="Skilled AC and electrical technician with digital multimeter"
                  referrerPolicy="no-referrer"
                  onError={() => markImgErr('tech')}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <Wrench className="w-10 h-10" />
                </div>
              )}
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <div className="text-xs text-slate-500">{t.marketplace.portal3Eyebrow}</div>
                <h3 className="text-lg font-semibold text-slate-900 mt-1">{t.marketplace.portal3Title}</h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  {t.marketplace.portal3Desc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectCategoryPortal('technician')}
                className="min-h-[44px] w-full flex items-center justify-between rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors"
              >
                <span>{t.marketplace.portal3Cta}</span>
                <ArrowRight className="w-4 h-4 text-amber-600" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* AI-Recommended Section (Matches Current Location & Booking History) */}
      {aiRecommendedPicks.length > 0 && (
        <section
          aria-labelledby="ai-recommended-heading"
          className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-lg border border-amber-200 bg-amber-50 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-amber-700" />
              </div>
              <div className="space-y-0.5">
                <h2 id="ai-recommended-heading" className="text-lg font-bold tracking-tight text-slate-900">
                  {t.marketplace.aiRecommendedTitle}
                </h2>
                <p className="text-xs text-slate-600">{t.marketplace.aiRecommendedSub}</p>
                <div className="text-xs text-slate-500 font-mono tabular-nums pt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    {t.marketplace.aiLocationPrefix}:{' '}
                    <span className="font-medium text-slate-800">
                      {recommendationOrigin.sourceLabel || t.common.allMumbaiZones}
                    </span>
                  </span>
                  {userBookedSkillsList.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t.marketplace.aiHistoryBasedPrefix}:{' '}
                        <span className="font-medium text-slate-800">
                          {userBookedSkillsList
                            .slice(0, 3)
                            .map((s) => translateSkillCategory(s, language))
                            .join(', ')}
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {location.status !== 'active' && (
                <button
                  type="button"
                  onClick={() => location.requestLocation()}
                  disabled={location.status === 'locating'}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                >
                  {location.status === 'locating' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  ) : (
                    <LocateFixed className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <span>
                    {location.status === 'locating' ? t.marketplace.locating : t.marketplace.useMyLocation}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={handleRefreshAiPicks}
                disabled={aiRefreshing}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${aiRefreshing ? 'animate-spin' : ''}`} />
                <span>{aiRefreshing ? t.marketplace.aiRefreshing : t.marketplace.aiRefreshBtn}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiRecommendedPicks.map(({ tech, distanceKm, withinServiceRadius, reason }) => {
              const techReviews = reviewsByTech.get(tech.id) || reviewsByTech.get(tech.ownerId) || [];
              const reviewCount = Math.max(techReviews.length, tech.ratingCount ?? 0);
              const avgRating =
                techReviews.length > 0
                  ? techReviews.reduce((sum, r) => sum + r.rating, 0) / techReviews.length
                  : tech.ratingAvg ?? 0;
              const nextSlot = findNextFreeSlot(tech.busySlots || []);
              const displayReason = aiReasonsMap[tech.id] || reason;

              return (
                <div
                  key={`ai_rec_${tech.id}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500 truncate">
                          {translateSkillCategory(tech.skillCategory, language)} · {tech.clusterZone}
                          {distanceKm !== null
                            ? ` · ${formatDistanceKm(distanceKm)} ${t.common.kmAway}`
                            : ''}
                          {withinServiceRadius ? ` (${t.common.inRange})` : ''}
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 mt-0.5 flex items-center gap-1.5">
                          <span className="truncate">{tech.fullName}</span>
                          {tech.verified && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleBookmarkClick({
                            targetType: 'technician',
                            targetId: tech.id,
                            targetName: tech.fullName,
                            category: tech.skillCategory,
                            clusterZone: tech.clusterZone,
                          })
                        }
                        aria-pressed={savedSet.has(`technician_${tech.id}`)}
                        aria-label={
                          savedSet.has(`technician_${tech.id}`)
                            ? `Remove ${tech.fullName} from saved`
                            : `Save ${tech.fullName} to favorites`
                        }
                        className={`min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg border shrink-0 transition-colors ${
                          savedSet.has(`technician_${tech.id}`)
                            ? 'border-amber-300 bg-amber-50 text-amber-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <Bookmark
                          className={`w-3.5 h-3.5 ${
                            savedSet.has(`technician_${tech.id}`) ? 'fill-amber-500 text-amber-600' : ''
                          }`}
                        />
                      </button>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">{displayReason}</p>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 font-mono tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Star
                          className={`w-3.5 h-3.5 ${
                            reviewCount > 0 ? 'fill-amber-400 text-amber-500' : 'text-slate-400'
                          }`}
                        />
                        <span className="font-semibold text-slate-900">{avgRating.toFixed(1)}</span>
                        <span className="text-slate-500">({reviewCount})</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {tech.experienceYears} {t.common.yrsExp}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-700">
                        {t.marketplace.nextFree} {formatSlotDisplay(nextSlot.isoDate, nextSlot.slotId)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                      {formatINR(tech.expectedCharge)}
                    </div>
                    <button
                      type="button"
                      onClick={() => onBookTechnician(tech)}
                      className="min-h-[38px] rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                    >
                      {t.marketplace.bookService}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Live Marketplace Directory */}
      <section id="marketplace-directory" className="space-y-6 scroll-mt-24">
        {(searchTerm.trim() !== '' || selectedZone !== 'All' || distanceLimit !== 'all' || location.status === 'active') && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-700">
            <div className="font-mono tabular-nums">
              {t.marketplace.matchesLabel}
              {searchTerm.trim() ? ` "${searchTerm.trim()}"` : ''}
              {distanceContext && maxDistKm !== null
                ? ` · <= ${maxDistKm} km (${distanceContext.originLabel})`
                : distanceContext
                  ? ` · ${distanceContext.originLabel}`
                  : selectedZone !== 'All'
                    ? ` · ${selectedZone}`
                    : ''}
              :{' '}
              <span className="font-semibold text-slate-900">
                {filteredTechs.length} {t.marketplace.tabTechnicians} · {filteredContractors.length} {t.marketplace.tabContractors} · {filteredShops.length} {t.marketplace.tabShops}
              </span>
            </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-medium text-amber-700 hover:text-amber-800"
            >
              {t.marketplace.resetFilters}
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 w-fit">
            {(
              [
                ['technicians', `${t.marketplace.tabTechnicians} (${filteredTechs.length})`],
                ['contractors', `${t.marketplace.tabContractors} (${filteredContractors.length})`],
                ['shops', `${t.marketplace.tabShops} (${filteredShops.length})`],
                ['products', `${t.marketplace.tabProducts} (${filteredProducts.length})`],
                ['projects', `${t.marketplace.tabProjects} (${filteredProjects.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFeed(key)}
                className={`min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeFeed === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeFeed === 'technicians' && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedSkill}
                onChange={(e) => {
                  setSelectedSkill(e.target.value);
                  setSelectedSubcategory('All');
                }}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800"
              >
                <option value="All">{t.marketplace.allSkillCategories}</option>
                {SKILL_CATEGORIES.map((s) => (
                  <option key={s} value={s}>
                    {translateSkillCategory(s, language)}
                  </option>
                ))}
              </select>
              {selectedSkill === 'Automotive Services' && (
                <select
                  value={selectedSubcategory}
                  onChange={(e) => setSelectedSubcategory(e.target.value)}
                  className="min-h-[40px] rounded-lg border border-amber-300 bg-amber-50/40 px-3 py-2 text-xs font-medium text-slate-800"
                >
                  <option value="All">All Automotive &amp; EV Specialties</option>
                  {AUTOMOTIVE_SUBCATEGORIES.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as 'All' | 'A' | 'B' | 'C')}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800"
              >
                <option value="All">{t.marketplace.allGrades}</option>
                <option value="A">{t.marketplace.gradeAOption}</option>
                <option value="B">{t.marketplace.gradeBOption}</option>
                <option value="C">{t.marketplace.gradeCOption}</option>
              </select>
            </div>
          )}

          {activeFeed === 'products' && (
            <select
              value={selectedProdCat}
              onChange={(e) => setSelectedProdCat(e.target.value)}
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800"
            >
              <option value="All">{t.marketplace.allProductCategories}</option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {translateProductCategory(c, language)}
                </option>
              ))}
            </select>
          )}
        </div>

        {activeFeed === 'technicians' && (
          filteredTechs.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-3">
              <p className="text-sm font-medium text-slate-900">{t.marketplace.noTechsEmpty}</p>
              <p className="text-xs text-slate-500">
                {t.marketplace.noTechsSub}
              </p>
              <button
                type="button"
                onClick={() => onSelectCategoryPortal('technician')}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                {t.marketplace.registerAsTech}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTechs.map(({ tech, distInfo }) => {
                const expCat = tech.experienceCategory || getExperienceCategory(tech.experienceYears);
                const displayGrade =
                  tech.adminGrade && tech.adminGrade !== 'Pending'
                    ? `Category ${tech.adminGrade} (Graded)`
                    : `Category ${expCat} (Exp)`;
                const techReviews = reviewsByTech.get(tech.id) || reviewsByTech.get(tech.ownerId) || [];
                const reviewCount = Math.max(techReviews.length, tech.ratingCount ?? 0);
                const avgRating =
                  techReviews.length > 0
                    ? techReviews.reduce((sum, r) => sum + r.rating, 0) / techReviews.length
                    : tech.ratingAvg ?? 0;
                const latestReview =
                  techReviews.find((r) => r.reviewText.trim().length > 0) || techReviews[0];

                return (
                <div key={tech.id} className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                          {tech.photoUrl && !imgErrors[`tech_${tech.id}`] ? (
                            <img
                              src={tech.photoUrl}
                              alt={tech.fullName}
                              referrerPolicy="no-referrer"
                              onError={() => markImgErr(`tech_${tech.id}`)}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-bold text-slate-500">
                              {tech.fullName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500 truncate">
                            {translateSkillCategory(tech.skillCategory, language)} · {tech.clusterZone} · {tech.workingRadiusKm} {t.marketplace.radiusUnit}
                          </div>
                          <h3 className="text-base font-semibold text-slate-900 mt-0.5 flex items-center gap-1.5">
                            <span className="truncate">{tech.fullName}</span>
                            {tech.verified && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs font-medium ${
                            tech.availabilityStatus === 'Available'
                              ? 'text-emerald-700'
                              : tech.availabilityStatus === 'Busy'
                                ? 'text-amber-700'
                                : 'text-slate-500'
                          }`}
                        >
                          {translateAvailability(tech.availabilityStatus, language)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleBookmarkClick({
                              targetType: 'technician',
                              targetId: tech.id,
                              targetName: tech.fullName,
                              category: tech.skillCategory,
                              clusterZone: tech.clusterZone,
                            })
                          }
                          aria-pressed={savedSet.has(`technician_${tech.id}`)}
                          aria-label={
                            savedSet.has(`technician_${tech.id}`)
                              ? `Remove ${tech.fullName} from saved`
                              : `Save ${tech.fullName} to favorites`
                          }
                          className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border transition-colors ${
                            savedSet.has(`technician_${tech.id}`)
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          <Bookmark
                            className={`w-4 h-4 ${
                              savedSet.has(`technician_${tech.id}`) ? 'fill-amber-500 text-amber-600' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 line-clamp-2">
                      {tech.workDescription || `${tech.experienceYears} years of hands-on ${tech.skillCategory} experience in Mumbai.`}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 font-mono tabular-nums pt-1">
                      <span className="font-semibold text-amber-700">{displayGrade}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Star
                          className={`w-3.5 h-3.5 ${
                            reviewCount > 0 ? 'fill-amber-400 text-amber-500' : 'text-slate-400'
                          }`}
                        />
                        <span className="font-semibold text-slate-900">{avgRating.toFixed(1)}</span>
                        <span className="text-slate-500">
                          ({reviewCount} {reviewCount === 1 ? t.common.review : t.common.reviews})
                        </span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{tech.experienceYears} {t.common.yrsExp}</span>
                      <span aria-hidden="true">·</span>
                      <span>{tech.completedJobsCount ?? 0} {t.common.jobs}</span>
                      {distInfo && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-slate-900">
                            {formatDistanceKm(distInfo.distanceKm)} {t.common.kmAway}
                            {distInfo.withinServiceRadius ? ` (${t.common.inRange})` : ''}
                          </span>
                        </>
                      )}
                    </div>

                    {tech.availabilityStatus === 'Available' && (
                      <div className="text-xs text-emerald-700 font-mono tabular-nums flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {t.marketplace.nextFree}{' '}
                          {(() => {
                            const nextSlot = findNextFreeSlot(tech.busySlots || []);
                            return formatSlotDisplay(nextSlot.isoDate, nextSlot.slotId);
                          })()}
                        </span>
                      </div>
                    )}

                    {latestReview && (
                      <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3 h-3 ${
                                  s <= latestReview.rating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] font-medium text-slate-500 truncate">
                            {latestReview.customerName} · {latestReview.clusterZone}
                          </span>
                        </div>
                        {latestReview.reviewText && (
                          <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                            &ldquo;{latestReview.reviewText}&rdquo;
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs text-slate-500 capitalize">
                        {tech.hourlyRate ? `Call-out ${formatINR(tech.calloutFee ?? tech.expectedCharge)} · ${formatINR(tech.hourlyRate)}/hr` : `${tech.workPreference} rate`}
                      </div>
                      <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                        {formatINR(tech.expectedCharge)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {techReviews.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setReviewsModalTech(tech)}
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{t.common.reviews} ({techReviews.length})</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={tech.availabilityStatus !== 'Available'}
                        onClick={() => onBookTechnician(tech)}
                        className="min-h-[40px] px-4 py-2 rounded-lg bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500 transition-colors whitespace-nowrap"
                      >
                        {tech.availabilityStatus === 'Available'
                          ? t.marketplace.bookService
                          : translateAvailability(tech.availabilityStatus, language)}
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )
        )}

        {activeFeed === 'contractors' && (
          filteredContractors.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-3">
              <p className="text-sm font-medium text-slate-900">{t.marketplace.noContractorsEmpty}</p>
              <button
                type="button"
                onClick={() => onSelectCategoryPortal('contractor')}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                {t.marketplace.registerAsContractor}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredContractors.map(({ contractor: c, distanceKm }) => {
                const openProjectCount = projects.filter(
                  (pr) => pr.contractorId === c.ownerId && pr.status === 'Open'
                ).length;
                return (
                  <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs text-slate-500">
                          {c.specialization || t.header.roleContractor} · {c.clusterZone}
                          {distanceKm !== null && (
                            <span className="font-mono tabular-nums font-medium text-slate-800">
                              {' '}
                              · {formatDistanceKm(distanceKm)} {t.common.kmAway}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleBookmarkClick({
                              targetType: 'contractor',
                              targetId: c.id,
                              targetName: c.companyName,
                              category: c.specialization || 'Contractor',
                              clusterZone: c.clusterZone,
                            })
                          }
                          aria-pressed={savedSet.has(`contractor_${c.id}`)}
                          aria-label={
                            savedSet.has(`contractor_${c.id}`)
                              ? `Remove ${c.companyName} from saved`
                              : `Save ${c.companyName} to favorites`
                          }
                          className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border shrink-0 transition-colors ${
                            savedSet.has(`contractor_${c.id}`)
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          <Bookmark
                            className={`w-4 h-4 ${
                              savedSet.has(`contractor_${c.id}`) ? 'fill-amber-500 text-amber-600' : ''
                            }`}
                          />
                        </button>
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
                        <span className="truncate">{c.companyName}</span>
                        {c.verified && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </h3>
                      <div className="text-xs text-slate-600">
                        {t.marketplace.contactPrefix} {c.contactName}
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <span className="text-xs font-mono tabular-nums text-slate-600">
                        {c.packageTier} · {openProjectCount} open project{openProjectCount === 1 ? '' : 's'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm(c.companyName);
                          setActiveFeed('projects');
                        }}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                      >
                        {t.marketplace.viewProjects}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {activeFeed === 'shops' && (
          filteredShops.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-3">
              <p className="text-sm font-medium text-slate-900">{t.marketplace.noShopsEmpty}</p>
              <button
                type="button"
                onClick={() => onSelectCategoryPortal('shopkeeper')}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                {t.marketplace.registerShop}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredShops.map(({ shop, distanceKm }) => {
                const shopItems = products.filter((p) => p.shopId === shop.id);
                const categories = Array.from(new Set(shopItems.map((p) => p.category))).slice(0, 3);
                return (
                  <div key={shop.id} className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs text-slate-500">
                          {shop.clusterZone} · {shop.sellerPlan} Plan
                          {distanceKm !== null && (
                            <span className="font-mono tabular-nums font-medium text-slate-800">
                              {' '}
                              · {formatDistanceKm(distanceKm)} {t.common.kmAway}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleBookmarkClick({
                              targetType: 'shop',
                              targetId: shop.id,
                              targetName: shop.shopName,
                              category: `${shop.sellerPlan} Plan`,
                              clusterZone: shop.clusterZone,
                            })
                          }
                          aria-pressed={savedSet.has(`shop_${shop.id}`)}
                          aria-label={
                            savedSet.has(`shop_${shop.id}`)
                              ? `Remove ${shop.shopName} from saved`
                              : `Save ${shop.shopName} to favorites`
                          }
                          className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border shrink-0 transition-colors ${
                            savedSet.has(`shop_${shop.id}`)
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          <Bookmark
                            className={`w-4 h-4 ${
                              savedSet.has(`shop_${shop.id}`) ? 'fill-amber-500 text-amber-600' : ''
                            }`}
                          />
                        </button>
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
                        <span className="truncate">{shop.shopName}</span>
                        {shop.verified && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </h3>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {shop.address} · {t.marketplace.ownerPrefix} {shop.ownerName}
                      </p>
                      {categories.length > 0 && (
                        <div className="text-xs text-slate-500 truncate">
                          {categories.map((c) => translateProductCategory(c, language)).join(' · ')}
                        </div>
                      )}
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <span className="text-xs font-mono tabular-nums text-slate-600">
                        {shopItems.length} product{shopItems.length === 1 ? '' : 's'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm(shop.shopName);
                          setActiveFeed('products');
                        }}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                      >
                        {t.marketplace.browseProducts}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {activeFeed === 'products' && (
          filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-3">
              <p className="text-sm font-medium text-slate-900">{t.marketplace.noProductsEmpty}</p>
              <button
                type="button"
                onClick={() => onSelectCategoryPortal('shopkeeper')}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                {t.marketplace.addProductsShopkeeper}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProducts.map(({ product, distanceKm }) => (
                <div key={product.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between">
                  <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                    {product.imageUrl && !imgErrors[`prod_${product.id}`] ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        onError={() => markImgErr(`prod_${product.id}`)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                        <ShoppingBag className="w-8 h-8 mb-1" />
                        <span className="text-xs">{translateProductCategory(product.category, language)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="text-xs text-slate-500">
                        {translateProductCategory(product.category, language)} · {product.clusterZone}
                        {distanceKm !== null && (
                          <span className="font-mono tabular-nums font-medium text-slate-800">
                            {' '}
                            · {formatDistanceKm(distanceKm)} {t.common.kmAway}
                          </span>
                        )}
                        {product.isPromoted ? ' · Sponsored' : ''}
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 mt-1">{product.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{t.marketplace.soldByPrefix} {product.shopName}</p>
                      {product.description && (
                        <p className="text-sm text-slate-600 mt-2 line-clamp-2">{product.description}</p>
                      )}
                      {((product.memberDiscountPercent || 0) > 0 || product.shippingAvailable) && (
                        <div className="mt-2.5 space-y-1 text-xs">
                          {(product.memberDiscountPercent || 0) > 0 && (
                            <div className="text-emerald-700 font-medium font-mono tabular-nums">
                              Member Discount: {product.memberDiscountPercent}% off (
                              {formatINR(
                                Math.max(
                                  0,
                                  Math.round(product.price * (1 - (product.memberDiscountPercent || 0) / 100))
                                )
                              )}
                              )
                            </div>
                          )}
                          {product.shippingAvailable && (
                            <div className="text-slate-600 flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span>
                                {product.courierPartner || 'Courier'} ·{' '}
                                {product.shippingFee ? formatINR(product.shippingFee) : 'Free shipping'}
                                {product.deliveryEta ? ` · ${product.deliveryEta}` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                          {formatINR(product.price)}
                        </div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums">
                          {product.stock > 0 ? `${product.stock} ${t.marketplace.inStockSuffix}` : t.marketplace.outOfStock}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={product.stock <= 0}
                          onClick={() => {
                            addToCart(product, 1);
                            onOpenCart?.();
                          }}
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                        <button
                          type="button"
                          disabled={product.stock <= 0}
                          onClick={() => onOrderProduct(product)}
                          className="min-h-[40px] px-3.5 py-2 rounded-lg bg-amber-600 text-xs font-medium text-white hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-500 transition-colors whitespace-nowrap"
                        >
                          {product.stock > 0 ? t.marketplace.placeOrder : t.marketplace.outOfStock}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeFeed === 'projects' && (
          filteredProjects.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-3">
              <p className="text-sm font-medium text-slate-900">{t.marketplace.noProjectsEmpty}</p>
              <button
                type="button"
                onClick={() => onSelectCategoryPortal('contractor')}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                {t.marketplace.postProjectContractor}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredProjects.map(({ project: proj, distanceKm }) => (
                <div key={proj.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-500">
                        {proj.companyName} · {proj.clusterZone} · {proj.engagementType}
                        {distanceKm !== null && (
                          <span className="font-mono tabular-nums font-medium text-slate-800">
                            {' '}
                            · {formatDistanceKm(distanceKm)} {t.common.kmAway}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 mt-1">{proj.title}</h3>
                    </div>
                    <span className="text-xs font-medium text-slate-700">{proj.status}</span>
                  </div>
                  {proj.description && <p className="text-sm text-slate-600">{proj.description}</p>}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-mono tabular-nums">
                    <span>
                      {translateSkillCategory(proj.requiredSkill, language)} · {proj.hiredCount}/{proj.workersNeeded} hired
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatINR(proj.budgetPerWorker)} / worker
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      {/* Technician Customer Reviews Modal */}
      {reviewsModalTech && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Customer reviews for ${reviewsModalTech.fullName}`}
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {(() => {
              const modalReviews =
                reviewsByTech.get(reviewsModalTech.id) ||
                reviewsByTech.get(reviewsModalTech.ownerId) ||
                [];
              const modalCount = Math.max(modalReviews.length, reviewsModalTech.ratingCount ?? 0);
              const modalAvg =
                modalReviews.length > 0
                  ? modalReviews.reduce((s, r) => s + r.rating, 0) / modalReviews.length
                  : reviewsModalTech.ratingAvg ?? 0;

              return (
                <>
                  <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-500">
                        {translateSkillCategory(reviewsModalTech.skillCategory, language)} · {reviewsModalTech.clusterZone}
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mt-0.5 flex items-center gap-2">
                        <span>{reviewsModalTech.fullName}</span>
                        <span className="inline-flex items-center gap-1 text-sm font-mono tabular-nums text-amber-700">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                          {modalAvg.toFixed(1)} ({modalCount})
                        </span>
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReviewsModalTech(null)}
                      aria-label={t.common.close}
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-5 overflow-y-auto divide-y divide-slate-100 space-y-1">
                    {modalReviews.map((review) => (
                      <div key={review.id} className="pt-3 first:pt-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">{review.customerName}</span>
                            <span className="text-xs text-slate-500">
                              {review.clusterZone} · {translateSkillCategory(review.skillCategory, language)}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3.5 h-3.5 ${
                                  s <= review.rating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.reviewText && (
                          <p className="text-sm text-slate-600 leading-relaxed">{review.reviewText}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-600 font-mono tabular-nums">
                      {t.marketplace.rateLabel} {formatINR(reviewsModalTech.expectedCharge)} ({reviewsModalTech.workPreference})
                    </div>
                    <button
                      type="button"
                      disabled={reviewsModalTech.availabilityStatus !== 'Available'}
                      onClick={() => {
                        const target = reviewsModalTech;
                        setReviewsModalTech(null);
                        onBookTechnician(target);
                      }}
                      className="min-h-[40px] px-4 py-2 rounded-lg bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      {reviewsModalTech.availabilityStatus === 'Available'
                        ? t.marketplace.bookService
                        : translateAvailability(reviewsModalTech.availabilityStatus, language)}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
