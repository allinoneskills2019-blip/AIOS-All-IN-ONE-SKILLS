import type { ServiceBooking } from '../types';

export interface TimeSlotDef {
  id: string;
  label: string;
  shortLabel: string;
}

export const SERVICE_TIME_SLOTS: TimeSlotDef[] = [
  { id: '09:00-12:00', label: '09:00 – 12:00', shortLabel: 'Morning' },
  { id: '12:00-15:00', label: '12:00 – 15:00', shortLabel: 'Afternoon' },
  { id: '15:00-18:00', label: '15:00 – 18:00', shortLabel: 'Evening' },
  { id: '18:00-21:00', label: '18:00 – 21:00', shortLabel: 'Night' },
];

export interface WeekDayInfo {
  isoDate: string;
  weekdayShort: string;
  dayNumber: string;
  monthShort: string;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWeekDays(weekOffset = 0): WeekDayInfo[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayIso = toLocalIsoDate(today);

  // Monday-start week
  const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday + weekOffset * 7);

  const days: WeekDayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const isoDate = toLocalIsoDate(d);
    const dow = d.getDay();
    days.push({
      isoDate,
      weekdayShort: WEEKDAY_NAMES[dow],
      dayNumber: String(d.getDate()).padStart(2, '0'),
      monthShort: MONTH_NAMES[d.getMonth()],
      isToday: isoDate === todayIso,
      isPast: d.getTime() < today.getTime(),
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return days;
}

export function formatWeekRangeLabel(days: WeekDayInfo[]): string {
  if (days.length === 0) return '';
  const first = days[0];
  const last = days[days.length - 1];
  return `${first.weekdayShort} ${Number(first.dayNumber)} ${first.monthShort} – ${last.weekdayShort} ${Number(last.dayNumber)} ${last.monthShort}`;
}

export function makeSlotKey(isoDate: string, slotId: string): string {
  return `${isoDate}|${slotId}`;
}

export function prunePastBusySlots(busySlots: string[]): string[] {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const cutoffIso = toLocalIsoDate(cutoff);

  const unique = new Set<string>();
  for (const key of busySlots) {
    if (typeof key !== 'string') continue;
    const [datePart] = key.split('|');
    if (datePart && datePart >= cutoffIso) {
      unique.add(key);
    }
  }
  return Array.from(unique).sort().slice(0, 120);
}

export function getBookedSlotSet(bookings: ServiceBooking[], technicianId?: string): Set<string> {
  const set = new Set<string>();
  if (!technicianId) return set;
  for (const b of bookings) {
    if (
      b.technicianId === technicianId &&
      b.scheduledSlot &&
      (b.status === 'Requested' || b.status === 'Accepted' || b.status === 'In Progress')
    ) {
      set.add(makeSlotKey(b.scheduledDate, b.scheduledSlot));
    }
  }
  return set;
}

export function findNextFreeSlot(
  busySlots: string[] = [],
  bookings: ServiceBooking[] = [],
  technicianId?: string
): { isoDate: string; slotId: string } {
  const busySet = new Set(busySlots);
  const bookedSet = getBookedSlotSet(bookings, technicianId);

  for (let weekOffset = 0; weekOffset <= 2; weekOffset++) {
    const days = getWeekDays(weekOffset);
    for (const day of days) {
      if (day.isPast) continue;
      for (const slot of SERVICE_TIME_SLOTS) {
        const key = makeSlotKey(day.isoDate, slot.id);
        if (!busySet.has(key) && !bookedSet.has(key)) {
          return { isoDate: day.isoDate, slotId: slot.id };
        }
      }
    }
  }

  return { isoDate: toLocalIsoDate(new Date()), slotId: SERVICE_TIME_SLOTS[0].id };
}

export function formatSlotDisplay(isoDate: string, slotId?: string): string {
  const parts = isoDate.split('-').map(Number);
  let dateLabel = isoDate;
  if (parts.length === 3 && !parts.some(Number.isNaN)) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    dateLabel = `${WEEKDAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  }
  if (!slotId) return dateLabel;
  const def = SERVICE_TIME_SLOTS.find((s) => s.id === slotId);
  return `${dateLabel} · ${def ? `${def.label} (${def.shortLabel})` : slotId}`;
}
