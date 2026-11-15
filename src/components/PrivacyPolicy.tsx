import React from 'react';
import { ShieldCheck, X } from 'lucide-react';

interface PrivacyPolicyProps {
  open: boolean;
  onClose: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-policy-heading"
    >
      <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <div>
              <h2 id="privacy-policy-heading" className="text-lg font-bold text-slate-900">
                Privacy Policy — All in One Skill
              </h2>
              <p className="text-xs text-slate-500">
                Mumbai Service &amp; Workforce Marketplace · Effective 2026
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close privacy policy"
            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-700 leading-relaxed">
          <section className="space-y-1.5">
            <h3 className="text-sm font-semibold text-slate-900">
              1. Account &amp; Personal Information (PII Protection)
            </h3>
            <p className="text-xs text-slate-600">
              All in One Skill collects only essential account information (name, mobile number verified via OTP or Google email, selected role, and Mumbai service zone). Sensitive contact details, delivery addresses, bank/UPI references, and only the last 4 digits of Aadhaar for partner KYC are stored in an owner-isolated private subcollection (<code className="font-mono">/users/&#123;uid&#125;/private/pii</code>) accessible strictly to you and authorized marketplace administrators.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-sm font-semibold text-slate-900">
              2. Geolocation &amp; Mumbai Service Radius Data
            </h3>
            <p className="text-xs text-slate-600">
              When you tap &ldquo;Use My Location&rdquo; or &ldquo;Scan 5 km Radius&rdquo;, your device GPS coordinates are processed strictly on-device to identify your nearest Mumbai City or Mumbai Suburban cluster (e.g., Colaba, Dadar, Bandra, Andheri, Borivali, Ghatkopar, Powai, Chembur) and measure kilometer distance to available technicians. Raw GPS coordinates are never sold, shared with third-party ad networks, or published on public listings; you may select any Mumbai fallback zone manually without enabling GPS.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-sm font-semibold text-slate-900">
              3. Payment, Digital Wallet &amp; Transaction Information
            </h3>
            <p className="text-xs text-slate-600">
              All bookings, direct product purchases, and partner membership renewals store only non-sensitive payment metadata such as payment method (UPI, Digital Wallet, or Card gateway), transaction/UTR reference ID, amount, and verification status. Full card numbers, CVVs, or UPI PINs are never stored by All in One Skill servers or Firestore.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-sm font-semibold text-slate-900">
              4. Technician Verification Documents &amp; Voice Queries
            </h3>
            <p className="text-xs text-slate-600">
              Certificates, trade licenses, and field degrees uploaded by technicians are restricted strictly to the technician owner and platform administrators for grading and trust verification. Queries submitted to the AI Voice Assistant are used exclusively to return relevant service categories, Mumbai cluster availability, and booking guidance.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-sm font-semibold text-slate-900">
              5. Your Rights, Consent &amp; Support Contact
            </h3>
            <p className="text-xs text-slate-600">
              You may review or update your profile, switch roles, revoke browser geolocation or notification permissions at any time, or request account deletion and data export through your dashboard support desk or by contacting the Marketplace Administrator at{' '}
              <span className="font-mono text-slate-900">allinoneskills2019@gmail.com</span>.
            </p>
          </section>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-lg bg-slate-900 px-5 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            Close Policy
          </button>
        </div>
      </div>
    </div>
  );
};
