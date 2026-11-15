import QRCode from 'qrcode';
import type { ServiceBooking, TechnicianProfile } from '../types';

export const PLATFORM_ESCROW_UPI_VPA = 'allinoneskill.pay@okicici';
const UPI_VPA_REGEX = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9.\-]{2,64}$/;

export function isValidUpiVpa(vpa: string): boolean {
  return UPI_VPA_REGEX.test(vpa.trim());
}

export interface UpiPaymentPayload {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  bookingId: string;
  skillCategory: string;
  clusterZone: string;
}

export function resolveBookingPayeeVpa(
  booking: ServiceBooking,
  tech?: TechnicianProfile | null
): { vpa: string; source: 'technician_profile' | 'platform_settlement' } {
  const candidate = tech?.upiId?.trim() || '';
  if (candidate && isValidUpiVpa(candidate)) {
    return { vpa: candidate, source: 'technician_profile' };
  }
  return {
    vpa: PLATFORM_ESCROW_UPI_VPA,
    source: 'platform_settlement',
  };
}

export function buildUpiPaymentUri(payload: UpiPaymentPayload): string {
  const pa = payload.payeeVpa.trim();
  const pn = payload.payeeName.trim().slice(0, 60) || 'All in One Skill';
  const am = Math.max(0, Number(payload.amount) || 0).toFixed(2);
  const tr = `AIOS${payload.bookingId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toUpperCase()}`;
  const tn = `All in One Skill - ${payload.skillCategory} (${payload.clusterZone})`.slice(0, 80);

  const params = new URLSearchParams({
    pa,
    pn,
    tr,
    tn,
    am,
    cu: 'INR',
  });

  return `upi://pay?${params.toString()}`;
}

export async function generateUpiQrDataUrl(upiUri: string): Promise<string> {
  return QRCode.toDataURL(upiUri, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}
