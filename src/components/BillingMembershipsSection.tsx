import React, { useMemo, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { CreditCard, ShieldCheck, Smartphone, CheckCircle2 } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { db } from '../lib/firebase';
import { formatINR, MEMBERSHIP_QUOTA_TIERS } from '../lib/constants';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';

interface BillingMembershipsSectionProps {
  role: 'technician' | 'contractor';
  currentTier?: string;
  membershipStatus?: string;
  quotaUsed?: number;
  quotaLimit?: number;
  expiresAt?: string;
  onStatusMessage?: (msg: string) => void;
}

export const BillingMembershipsSection: React.FC<BillingMembershipsSectionProps> = ({
  role,
  currentTier = 'None',
  membershipStatus = 'none',
  quotaUsed = 0,
  quotaLimit = 5,
  expiresAt,
  onStatusMessage,
}) => {
  const { user, userAccount, transactions, platformConfig } = useMarketplace();
  const [selectedQuota, setSelectedQuota] = useState<number>(10);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Card'>('UPI');
  const [upiOrCardRef, setUpiOrCardRef] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  const pendingMembershipTxs = useMemo(
    () =>
      transactions.filter(
        (tx) =>
          (tx.txType === 'technician_membership' || tx.txType === 'contractor_package') &&
          tx.status === 'Pending Verification'
      ),
    [transactions]
  );

  const resolvedTiers = useMemo(() => {
    return MEMBERSHIP_QUOTA_TIERS.map((tier) => {
      let price: number = tier.defaultPrice;
      if (role === 'technician') {
        if (tier.quota === 5 && platformConfig.technicianMonthlyFee > 0) {
          price = platformConfig.technicianMonthlyFee;
        } else if (tier.quota === 10 && platformConfig.technicianMonthlyFee > 0) {
          price = Math.round(platformConfig.technicianMonthlyFee * 1.6);
        } else if (tier.quota === 50 && platformConfig.technicianYearlyFee > 0) {
          price = platformConfig.technicianYearlyFee;
        } else if (tier.quota === 300 && platformConfig.technicianYearlyFee > 0) {
          price = Math.round(platformConfig.technicianYearlyFee * 2.5);
        }
      } else {
        const cfgMatch = platformConfig.contractorPackages.find((p) => p.tier === tier.packageTier);
        if (cfgMatch && cfgMatch.price > 0) {
          price = tier.quota === 5 ? Math.round(cfgMatch.price * 0.5) : cfgMatch.price;
        }
      }
      return { ...tier, resolvedPrice: price };
    });
  }, [role, platformConfig]);

  const activeTierObj = resolvedTiers.find((t) => t.quota === selectedQuota) || resolvedTiers[1];
  const effectiveQuotaLimit = Math.max(1, quotaLimit || 5);
  const remainingQuota = Math.max(0, effectiveQuotaLimit - quotaUsed);
  const utilizationPercent = Math.min(100, Math.round((quotaUsed / effectiveQuotaLimit) * 100));

  const handleCheckoutMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLocalMsg(null);

    if (paymentMethod === 'UPI' && !upiOrCardRef.trim()) {
      setLocalMsg('Enter your UPI transaction / UTR reference ID.');
      return;
    }
    if (paymentMethod === 'Card' && cardLast4.replace(/\D/g, '').length < 4) {
      setLocalMsg('Enter the last 4 digits of your Credit/Debit Card for gateway verification.');
      return;
    }

    setSubmitting(true);
    try {
      const refCode =
        paymentMethod === 'UPI'
          ? upiOrCardRef.trim()
          : `CARD-${cardLast4.replace(/\D/g, '').slice(-4)}-${Date.now().toString().slice(-6)}`;

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userName: userAccount?.displayName || user.displayName || 'Mumbai Partner',
        txType: role === 'contractor' ? 'contractor_package' : 'technician_membership',
        amount: activeTierObj.resolvedPrice,
        commissionAmount: activeTierObj.resolvedPrice,
        referenceId: `${activeTierObj.packageTier} (${activeTierObj.quota} quota)`,
        utrReference: refCode.slice(0, 100),
        paymentMethod,
        status: 'Pending Verification',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const msg = `${activeTierObj.name} (${activeTierObj.quota} leads/categories) payment submitted via ${paymentMethod}. Ref: ${refCode}`;
      setLocalMsg(msg);
      onStatusMessage?.(msg);
      setUpiOrCardRef('');
      setCardLast4('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'transactions');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="billing-memberships-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 id="billing-memberships-heading" className="text-base font-semibold text-slate-900">
            Billing &amp; Memberships
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Track remaining lead/category quotas, plan expiry, and renew securely via UPI or Credit/Debit Card.
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-700">
          Status:{' '}
          <span className="font-semibold text-slate-900 uppercase">
            {membershipStatus === 'active' || currentTier !== 'None' ? 'Active' : 'Free Trial'}
          </span>
          {currentTier && currentTier !== 'None' ? ` · ${currentTier}` : ''}
          {expiresAt ? ` · Expires ${expiresAt}` : ' · 30-day cycle'}
        </div>
      </div>

      {/* Quota Utilization Bar */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-slate-700">
            {role === 'contractor' ? 'Contractor Lead & Profile Quota' : 'Service Lead & Category Quota'}
          </span>
          <span className="font-mono tabular-nums font-semibold text-slate-900">
            {remainingQuota} remaining of {effectiveQuotaLimit} ({quotaUsed} used)
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full bg-amber-600 transition-all"
            style={{ width: `${Math.max(4, utilizationPercent)}%` }}
          />
        </div>
        {pendingMembershipTxs.length > 0 && (
          <div className="text-xs text-amber-800 pt-1">
            {pendingMembershipTxs.length} membership payment{pendingMembershipTxs.length > 1 ? 's' : ''} awaiting admin verification (latest ref:{' '}
            <span className="font-mono">{pendingMembershipTxs[0].utrReference}</span>).
          </div>
        )}
      </div>

      {/* 4 Quota Plan Options: 5 / 10 / 50 / 300 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {resolvedTiers.map((tier) => {
          const isSelected = selectedQuota === tier.quota;
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => setSelectedQuota(tier.quota)}
              className={`text-left rounded-xl border p-4 transition-colors flex flex-col justify-between space-y-3 ${
                isSelected
                  ? 'border-amber-600 bg-amber-50/40'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono tabular-nums">{tier.validityDays}d validity</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />}
                </div>
                <div className="text-sm font-semibold text-slate-900">{tier.name}</div>
                <div className="text-xs text-slate-600">{tier.targetAudience}</div>
              </div>
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                  {formatINR(tier.resolvedPrice)}
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-700">
                  Quota: {tier.quota} {role === 'contractor' ? 'worker leads' : 'leads/categories'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {localMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900">
          {localMsg}
        </div>
      )}

      {/* Payment Gateway Checkout Form */}
      <form
        onSubmit={handleCheckoutMembership}
        className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Checkout: {activeTierObj.name} · {formatINR(activeTierObj.resolvedPrice)}
            </div>
            <div className="text-xs text-slate-500">{activeTierObj.features}</div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 w-fit shrink-0">
            <button
              type="button"
              onClick={() => setPaymentMethod('UPI')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                paymentMethod === 'UPI' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> UPI / QR
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('Card')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                paymentMethod === 'Card' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" /> Credit / Debit Card
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          {paymentMethod === 'UPI' ? (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                UPI Transaction / UTR Reference (Pay to allinoneskill@upi)
              </label>
              <input
                type="text"
                value={upiOrCardRef}
                onChange={(e) => setUpiOrCardRef(e.target.value)}
                placeholder="e.g. 429811045912"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          ) : (
            <div className="sm:col-span-2 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Card Last 4 Digits (Razorpay/Stripe Ref)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  inputMode="numeric"
                  value={cardLast4}
                  onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="4242"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  value={upiOrCardRef}
                  onChange={(e) => setUpiOrCardRef(e.target.value)}
                  placeholder="Name on card"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>{submitting ? 'Submitting...' : `Pay & Activate ${activeTierObj.quota} Quota`}</span>
          </button>
        </div>
      </form>
    </section>
  );
};
