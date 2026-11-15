import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  QrCode,
  Smartphone,
  X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { formatSlotDisplay } from '../lib/availability';
import { formatINR } from '../lib/constants';
import {
  buildUpiPaymentUri,
  generateUpiQrDataUrl,
  isValidUpiVpa,
  resolveBookingPayeeVpa,
} from '../lib/upiQr';
import type { ServiceBooking, TechnicianProfile } from '../types';

interface ServicePaymentQrModalProps {
  booking: ServiceBooking;
  technician?: TechnicianProfile | null;
  utrValue: string;
  onChangeUtr: (val: string) => void;
  onSubmitUtr: () => Promise<void> | void;
  onClose: () => void;
}

export const ServicePaymentQrModal: React.FC<ServicePaymentQrModalProps> = ({
  booking,
  technician,
  utrValue,
  onChangeUtr,
  onSubmitUtr,
  onClose,
}) => {
  const { t } = useLanguage();

  const resolvedDefault = useMemo(
    () => resolveBookingPayeeVpa(booking, technician),
    [booking, technician]
  );

  const [activeVpa, setActiveVpa] = useState<string>(resolvedDefault.vpa);
  const [vpaInput, setVpaInput] = useState<string>(resolvedDefault.vpa);
  const [editingVpa, setEditingVpa] = useState(false);
  const [vpaError, setVpaError] = useState<string | null>(null);

  const hasBookingFee = booking.bookingFee > 0 && booking.serviceCharge !== booking.totalAmount;
  const [amountMode, setAmountMode] = useState<'total' | 'service_only'>('total');
  const payableAmount =
    amountMode === 'service_only' && hasBookingFee
      ? booking.serviceCharge
      : booking.totalAmount;

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'link' | 'vpa' | null>(null);
  const [submittingUtr, setSubmittingUtr] = useState(false);

  useEffect(() => {
    setActiveVpa(resolvedDefault.vpa);
    setVpaInput(resolvedDefault.vpa);
    setEditingVpa(false);
    setVpaError(null);
  }, [booking.id, resolvedDefault.vpa]);

  const upiUri = useMemo(
    () =>
      buildUpiPaymentUri({
        payeeVpa: activeVpa,
        payeeName:
          resolvedDefault.source === 'technician_profile' || activeVpa !== resolvedDefault.vpa
            ? booking.technicianName
            : `${booking.technicianName} (All in One Skill)`,
        amount: payableAmount,
        bookingId: booking.id,
        skillCategory: booking.skillCategory,
        clusterZone: booking.clusterZone,
      }),
    [
      activeVpa,
      resolvedDefault.vpa,
      resolvedDefault.source,
      booking.technicianName,
      booking.id,
      booking.skillCategory,
      booking.clusterZone,
      payableAmount,
    ]
  );

  useEffect(() => {
    let cancelled = false;
    setQrError(null);
    generateUpiQrDataUrl(upiUri)
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrError('Unable to render QR code matrix. Use the UPI link below.');
      });
    return () => {
      cancelled = true;
    };
  }, [upiUri]);

  const handleApplyCustomVpa = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = vpaInput.trim();
    if (!isValidUpiVpa(trimmed)) {
      setVpaError('Enter a valid UPI ID (e.g. ramesh@okaxis or 9820012345@ybl).');
      return;
    }
    setActiveVpa(trimmed);
    setEditingVpa(false);
    setVpaError(null);
  };

  const handleCopy = async (text: string, type: 'link' | 'vpa') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      setCopiedType(null);
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `all-in-one-skill-upi-qr-${booking.id.slice(0, 8)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingUtr(true);
    try {
      await onSubmitUtr();
    } finally {
      setSubmittingUtr(false);
    }
  };

  const isUsingCustomOrTechVpa =
    activeVpa !== resolvedDefault.vpa || resolvedDefault.source === 'technician_profile';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Service payment QR code for booking ${booking.id}`}
    >
      <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full overflow-hidden my-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5 text-slate-900" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-mono tabular-nums text-slate-500">
                Ref #{booking.id.slice(0, 10).toUpperCase()} · {formatSlotDisplay(booking.scheduledDate, booking.scheduledSlot)}
              </div>
              <h4 className="text-base font-bold text-slate-900 truncate">
                {t.customer.qrModalTitle}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">{t.customer.qrModalSub}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close service QR modal"
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Provider & Payable Amount Strip */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="text-xs text-slate-500">
                {booking.skillCategory} · {booking.clusterZone}
              </div>
              <div className="text-sm font-semibold text-slate-900 truncate">
                {booking.technicianName}
              </div>
              <div className="text-xs text-slate-600 font-mono tabular-nums">
                Service: {formatINR(booking.serviceCharge)}
                {booking.bookingFee > 0 ? ` + Fee: ${formatINR(booking.bookingFee)}` : ''}
              </div>
            </div>
            <div className="sm:text-right shrink-0">
              <div className="text-xs text-slate-500">Payable Amount</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {formatINR(payableAmount)}
              </div>
            </div>
          </div>

          {/* Optional Amount Switcher if platform booking fee is non-zero */}
          {hasBookingFee && (
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 w-fit">
              <button
                type="button"
                onClick={() => setAmountMode('total')}
                className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  amountMode === 'total'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.customer.qrFullTotal} ({formatINR(booking.totalAmount)})
              </button>
              <button
                type="button"
                onClick={() => setAmountMode('service_only')}
                className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  amountMode === 'service_only'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.customer.qrServiceChargeOnly} ({formatINR(booking.serviceCharge)})
              </button>
            </div>
          )}

          {/* QR Code Showcase & Payee UPI ID */}
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col items-center justify-center shrink-0">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`UPI payment QR code for ${booking.technicianName} (${formatINR(payableAmount)})`}
                  className="w-48 h-48 object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-500 text-center px-3">
                  {qrError || 'Generating UPI QR code...'}
                </div>
              )}
              <span className="mt-1.5 text-[11px] font-medium text-slate-500">
                GPay · PhonePe · Paytm · BHIM
              </span>
            </div>

            <div className="flex-1 w-full space-y-3 min-w-0">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-600">
                    {t.customer.qrUpiIdLabel}
                  </span>
                  {!editingVpa && (
                    <button
                      type="button"
                      onClick={() => {
                        setVpaInput(activeVpa);
                        setEditingVpa(true);
                        setVpaError(null);
                      }}
                      className="text-xs font-medium text-amber-700 hover:underline whitespace-nowrap"
                    >
                      {t.customer.qrEditUpi}
                    </button>
                  )}
                </div>

                {editingVpa ? (
                  <form onSubmit={handleApplyCustomVpa} className="space-y-2">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={vpaInput}
                        onChange={(e) => setVpaInput(e.target.value)}
                        placeholder="technician@okaxis"
                        className="flex-1 min-w-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                      />
                      <button
                        type="submit"
                        className="min-h-[34px] rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                      >
                        {t.customer.qrApplyUpi}
                      </button>
                    </div>
                    {vpaError && <p className="text-[11px] text-red-600">{vpaError}</p>}
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-xs font-mono font-semibold text-slate-900 truncate">
                      {activeVpa}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeVpa, 'vpa')}
                      aria-label="Copy UPI ID"
                      className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 shrink-0"
                    >
                      {copiedType === 'vpa' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}

                <p className="text-[11px] text-slate-500">
                  {isUsingCustomOrTechVpa
                    ? `Direct technician UPI handle for ${booking.technicianName}.`
                    : 'All in One Skill UPI settlement handle (tap Change UPI ID to enter technician VPA directly).'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <a
                  href={upiUri}
                  className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>{t.customer.qrOpenUpiApp}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(upiUri, 'link')}
                    className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                  >
                    {copiedType === 'link' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{t.customer.qrCopied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 shrink-0" />
                        <span>{t.customer.qrCopyLink}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={!qrDataUrl}
                    onClick={handleDownloadQr}
                    className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.customer.qrDownloadPng}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Inline Payment / UTR Submission Status */}
          {booking.paymentStatus === 'Unpaid' ? (
            <form
              onSubmit={handleSubmitPayment}
              className="border-t border-slate-200 pt-4 space-y-2"
            >
              <label className="block text-xs font-medium text-slate-700">
                Completed UPI scan? Enter UTR / Transaction ID to verify payment:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  required
                  minLength={4}
                  maxLength={100}
                  value={utrValue}
                  onChange={(e) => onChangeUtr(e.target.value)}
                  placeholder="e.g. 431890123456 (12-digit UPI UTR)"
                  className="flex-1 min-h-[40px] rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono"
                />
                <button
                  type="submit"
                  disabled={submittingUtr}
                  className="min-h-[40px] rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60 whitespace-nowrap"
                >
                  {submittingUtr ? t.technician.sending : t.customer.qrSubmitUtr}
                </button>
              </div>
            </form>
          ) : (
            <div className="border-t border-slate-200 pt-4 flex items-center justify-between gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Payment Status: {booking.paymentStatus}
              </span>
              {booking.paymentReference && (
                <span className="font-mono tabular-nums text-slate-600">
                  UTR: {booking.paymentReference}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
