import type { ServiceBooking } from '../types';

export interface MaintenanceReminder {
  id: string;
  skillCategory: string;
  lastServiceDate: string;
  nextDueDate: string;
  intervalDays: number;
  daysUntilDue: number;
  isOverdue: boolean;
  providerName: string;
  clusterZone: string;
  recommendedAction: string;
}

const SKILL_INTERVAL_DAYS: Array<{ match: string[]; days: number; note: string }> = [
  {
    match: ['ac technician', 'hvac'],
    days: 120,
    note: 'Jet-pump coil wash, filter clean, and refrigerant pressure check before peak heat or monsoon.',
  },
  {
    match: ['ro technician'],
    days: 90,
    note: 'Sediment/carbon cartridge replacement and TDS calibration for safe drinking water.',
  },
  {
    match: ['automotive services', 'car mechanic', 'bike mechanic', 'ev'],
    days: 90,
    note: 'Periodic engine oil / brake pad check, battery health scan, and tire pressure inspection.',
  },
  {
    match: ['appliance repair'],
    days: 180,
    note: 'Drum descale, gasket inspection, and grounding safety check.',
  },
  {
    match: ['cleaning services'],
    days: 90,
    note: 'Quarterly deep sanitization for kitchen, bath, and upholstery.',
  },
  {
    match: ['electrician', 'cctv technician', 'networking', 'network technician', 'it engineering'],
    days: 180,
    note: 'RCCB trip test, backup battery check, and cable/firmware inspection.',
  },
];

function resolveInterval(skillCategory: string): { days: number; note: string } {
  const lower = (skillCategory || '').toLowerCase();
  const matched = SKILL_INTERVAL_DAYS.find((entry) =>
    entry.match.some((kw) => lower.includes(kw))
  );
  return (
    matched || {
      days: 180,
      note: 'Recommended 6-month preventive checkup to avoid unexpected breakdowns.',
    }
  );
}

function parseIsoDate(raw: string): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatYmd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function computeMaintenanceReminders(
  bookings: ServiceBooking[],
  now: Date = new Date()
): MaintenanceReminder[] {
  const valid = bookings.filter((b) => b.status === 'Completed' || b.status === 'Accepted' || b.status === 'In Progress');
  if (valid.length === 0) return [];

  // Deduplicate by skillCategory keeping most recent service date
  const latestBySkill = new Map<string, ServiceBooking>();
  for (const b of valid) {
    const existing = latestBySkill.get(b.skillCategory);
    if (!existing) {
      latestBySkill.set(b.skillCategory, b);
    } else {
      const existingDate = parseIsoDate(existing.scheduledDate)?.getTime() ?? 0;
      const currentDate = parseIsoDate(b.scheduledDate)?.getTime() ?? 0;
      if (currentDate >= existingDate) {
        latestBySkill.set(b.skillCategory, b);
      }
    }
  }

  const reminders: MaintenanceReminder[] = [];
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  for (const [skillCategory, b] of latestBySkill.entries()) {
    const baseDate = parseIsoDate(b.scheduledDate) || now;
    const { days, note } = resolveInterval(skillCategory);
    const nextDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    const nextMs = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate()).getTime();
    const daysUntilDue = Math.round((nextMs - todayMs) / (24 * 60 * 60 * 1000));

    reminders.push({
      id: `rem_${skillCategory}_${b.id}`.replace(/[^a-zA-Z0-9_\-]/g, '_'),
      skillCategory,
      lastServiceDate: formatYmd(baseDate),
      nextDueDate: formatYmd(nextDate),
      intervalDays: days,
      daysUntilDue,
      isOverdue: daysUntilDue <= 0,
      providerName: b.technicianName,
      clusterZone: b.clusterZone,
      recommendedAction: note,
    });
  }

  return reminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

export function triggerMaintenanceBrowserAlert(reminder: MaintenanceReminder): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') {
    try {
      new Notification(`${reminder.skillCategory} Maintenance Reminder`, {
        body: `Next service ${reminder.isOverdue ? 'was due' : 'is scheduled'} on ${reminder.nextDueDate} (${reminder.clusterZone}).`,
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
