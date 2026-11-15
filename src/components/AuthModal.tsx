import React, { useState } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { Phone, ShieldCheck, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useMarketplace } from '../context/MarketplaceContext';
import type { UserRole } from '../types';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultRole?: UserRole;
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose, defaultRole = 'customer' }) => {
  const { zones, signInWithGoogle, sendPhoneOtp, confirmPhoneOtp } = useMarketplace();
  const { t } = useLanguage();
  const [authTab, setAuthTab] = useState<'phone' | 'google'>('phone');
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole);
  const [clusterZone, setClusterZone] = useState<string>('Andheri');
  const [displayName, setDisplayName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleaned = phoneDigits.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      setErrorMsg('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setBusy(true);
    try {
      const res = await sendPhoneOtp(`+91${cleaned}`, 'firebase-recaptcha-container');
      setConfirmation(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('operation-not-allowed') || msg.includes('billing-not-enabled')) {
        setErrorMsg(
          'Firebase Phone OTP must be enabled in Firebase Console (Authentication → Sign-in method → Phone). You can also sign in right now using Google.'
        );
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmation) return;
    setErrorMsg(null);
    setBusy(true);
    try {
      await confirmPhoneOtp(
        confirmation,
        otpCode.trim(),
        displayName.trim() || 'Mumbai Partner',
        selectedRole,
        clusterZone
      );
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid OTP code.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setBusy(true);
    try {
      await signInWithGoogle(selectedRole, clusterZone);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t.auth.dialogTitle}</h2>
            <p className="text-xs text-slate-500">{t.auth.dialogSubtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.common.close}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Role & Mumbai Cluster Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t.auth.accountCategory}</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
              >
                <option value="customer">{t.header.roleCustomer}</option>
                <option value="shopkeeper">{t.header.roleShopkeeper}</option>
                <option value="contractor">{t.header.roleContractor}</option>
                <option value="technician">{t.header.roleTechnician}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t.auth.mumbaiCluster}</label>
              <select
                value={clusterZone}
                onChange={(e) => setClusterZone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.name}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Auth Method Segmented Control */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100">
            <button
              type="button"
              onClick={() => {
                setAuthTab('phone');
                setErrorMsg(null);
              }}
              className={`py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                authTab === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.auth.mobileOtpTab}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab('google');
                setErrorMsg(null);
              }}
              className={`py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                authTab === 'google' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.auth.googleAccountTab}
            </button>
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          {authTab === 'phone' ? (
            !confirmation ? (
              <form onSubmit={handleSendOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t.auth.fullName}</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t.auth.mobileNumber}</label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 text-sm font-mono text-slate-600">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={phoneDigits}
                      onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, ''))}
                      placeholder="9820012345"
                      required
                      className="w-full rounded-r-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                </div>
                <div id="firebase-recaptcha-container" />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Phone className="w-4 h-4" />
                  {busy ? t.auth.sendingOtp : t.auth.sendOtp}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <p className="text-xs text-slate-600">
                  OTP · <span className="font-mono font-medium">+91 {phoneDigits}</span>
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit OTP"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-base font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmation(null)}
                    className="flex-1 min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t.auth.changeNumber}
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 min-h-[44px] rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {busy ? t.auth.verifying : t.auth.verifyOtp}
                  </button>
                </div>
              </form>
            )
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                {t.auth.googleDesc}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleSignIn}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                {busy ? t.auth.connecting : t.auth.continueGoogle}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
