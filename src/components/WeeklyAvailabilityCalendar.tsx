import React, { useMemo, useState } from 'react';
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Lock } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  formatSlotDisplay,
  formatWeekRangeLabel,
  getWeekDays,
  makeSlotKey,
  SERVICE_TIME_SLOTS,
} from '../lib/availability';

interface WeeklyAvailabilityCalendarProps {
  mode: 'technician' | 'customer';
  busySlots: string[];
  bookedSlots?: Set<string>;
  selectedDate?: string;
  selectedSlot?: string;
  onSelectSlot?: (isoDate: string, slotId: string) => void;
  onToggleSlot?: (slotKey: string) => void;
  onToggleDay?: (isoDate: string, markBusy: boolean) => void;
  onMarkWeekendsBusy?: (weekWeekendIsos: string[]) => void;
  onClearWeek?: (weekDayIsos: string[]) => void;
  onSaveSchedule?: () => Promise<void> | void;
  saving?: boolean;
  hasUnsavedChanges?: boolean;
  disabledReason?: string | null;
}

export const WeeklyAvailabilityCalendar: React.FC<WeeklyAvailabilityCalendarProps> = ({
  mode,
  busySlots,
  bookedSlots,
  selectedDate,
  selectedSlot,
  onSelectSlot,
  onToggleSlot,
  onToggleDay,
  onMarkWeekendsBusy,
  onClearWeek,
  onSaveSchedule,
  saving = false,
  hasUnsavedChanges = false,
  disabledReason = null,
}) => {
  const { t } = useLanguage();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);
  const weekLabel = useMemo(() => formatWeekRangeLabel(weekDays), [weekDays]);
  const busySet = useMemo(() => new Set(busySlots), [busySlots]);

  const weekStats = useMemo(() => {
    let busyCount = 0;
    let freeCount = 0;
    let bookedCount = 0;
    for (const day of weekDays) {
      if (day.isPast) continue;
      for (const slot of SERVICE_TIME_SLOTS) {
        const key = makeSlotKey(day.isoDate, slot.id);
        if (bookedSlots?.has(key)) bookedCount += 1;
        else if (busySet.has(key)) busyCount += 1;
        else freeCount += 1;
      }
    }
    return { busyCount, freeCount, bookedCount };
  }, [weekDays, busySet, bookedSlots]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      {/* Calendar Header & Week Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
            <h4 className="text-sm font-semibold text-slate-900">
              {mode === 'technician'
                ? t.calendar.techTitle
                : t.calendar.custTitle}
            </h4>
          </div>
          <p className="text-xs text-slate-500">
            {mode === 'technician'
              ? t.calendar.techSub
              : t.calendar.custSub}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={weekOffset <= 0}
            onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
            aria-label="Previous week"
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className={`min-h-[36px] rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              weekOffset === 0
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t.calendar.thisWeek}
          </button>
          <span className="px-2 text-xs font-mono tabular-nums font-medium text-slate-700 whitespace-nowrap">
            {weekLabel}
          </span>
          <button
            type="button"
            disabled={weekOffset >= 3}
            onClick={() => setWeekOffset((w) => Math.min(3, w + 1))}
            aria-label="Next week"
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend & Weekly Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-emerald-300 bg-emerald-50 inline-block" />
            <span>{t.calendar.free} ({weekStats.freeCount})</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-slate-300 bg-slate-200 inline-block" />
            <span>{t.calendar.busy} ({weekStats.busyCount})</span>
          </span>
          {weekStats.bookedCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border border-amber-300 bg-amber-100 inline-block" />
              <span>{t.calendar.booked} ({weekStats.bookedCount})</span>
            </span>
          )}
          {mode === 'customer' && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-600 inline-block" />
              <span>{t.calendar.selectedSlotLabel}</span>
            </span>
          )}
        </div>

        {mode === 'technician' && (
          <div className="flex flex-wrap items-center gap-2">
            {onMarkWeekendsBusy && (
              <button
                type="button"
                onClick={() =>
                  onMarkWeekendsBusy(
                    weekDays.filter((d) => !d.isPast && d.isWeekend).map((d) => d.isoDate)
                  )
                }
                className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                {t.calendar.blockWeekends}
              </button>
            )}
            {onClearWeek && (
              <button
                type="button"
                onClick={() =>
                  onClearWeek(weekDays.filter((d) => !d.isPast).map((d) => d.isoDate))
                }
                className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                {t.calendar.markWeekFree}
              </button>
            )}
          </div>
        )}
      </div>

      {disabledReason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900">
          {disabledReason}
        </div>
      )}

      {/* 7-Day Weekly Slot Matrix */}
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr>
              <th className="w-32 text-left py-2 pr-3 text-[11px] font-medium text-slate-500 align-bottom">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {t.calendar.timeWindow}
                </span>
              </th>
              {weekDays.map((day) => {
                const futureDaySlots = SERVICE_TIME_SLOTS.map((s) => makeSlotKey(day.isoDate, s.id));
                const allDayBusy = futureDaySlots.every((k) => busySet.has(k));
                return (
                  <th
                    key={day.isoDate}
                    className={`py-2 px-1 text-center align-top ${
                      day.isToday ? 'bg-amber-50/50 rounded-t-lg' : ''
                    }`}
                  >
                    <div className="text-[11px] font-medium text-slate-500">{day.weekdayShort}</div>
                    <div
                      className={`text-xs font-mono tabular-nums font-semibold mt-0.5 ${
                        day.isToday ? 'text-amber-700' : day.isPast ? 'text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {day.dayNumber} {day.monthShort}
                    </div>
                    {mode === 'technician' && !day.isPast && onToggleDay && (
                      <button
                        type="button"
                        onClick={() => onToggleDay(day.isoDate, !allDayBusy)}
                        className="mt-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 whitespace-nowrap"
                      >
                        {allDayBusy ? t.calendar.freeDay : t.calendar.busyDay}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {SERVICE_TIME_SLOTS.map((slot) => (
              <tr key={slot.id}>
                <td className="py-2 pr-3 align-middle">
                  <div className="text-xs font-mono tabular-nums font-semibold text-slate-800 whitespace-nowrap">
                    {slot.label}
                  </div>
                  <div className="text-[11px] text-slate-500">{slot.shortLabel}</div>
                </td>
                {weekDays.map((day) => {
                  const key = makeSlotKey(day.isoDate, slot.id);
                  const isBooked = bookedSlots?.has(key) ?? false;
                  const isBusy = busySet.has(key);
                  const isSelected =
                    mode === 'customer' && selectedDate === day.isoDate && selectedSlot === slot.id;
                  const isPast = day.isPast;
                  const isLockedForCustomer =
                    mode === 'customer' && (isPast || isBusy || isBooked || Boolean(disabledReason));

                  let cellClasses =
                    'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/80';
                  let cellLabel = t.calendar.free;

                  if (isPast) {
                    cellClasses = 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed';
                    cellLabel = t.calendar.past;
                  } else if (isBooked) {
                    cellClasses = 'border-amber-300 bg-amber-100/70 text-amber-900 cursor-not-allowed';
                    cellLabel = t.calendar.booked;
                  } else if (isSelected) {
                    cellClasses = 'border-amber-600 bg-amber-600 text-white font-semibold shadow-sm';
                    cellLabel = t.calendar.selected;
                  } else if (isBusy) {
                    cellClasses =
                      mode === 'technician'
                        ? 'border-slate-300 bg-slate-200 text-slate-700 hover:bg-slate-300/80'
                        : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed';
                    cellLabel = t.calendar.busy;
                  }

                  return (
                    <td
                      key={key}
                      className={`p-1 align-middle ${day.isToday ? 'bg-amber-50/30' : ''}`}
                    >
                      <button
                        type="button"
                        disabled={
                          mode === 'technician'
                            ? isPast || isBooked || Boolean(disabledReason)
                            : isLockedForCustomer
                        }
                        aria-pressed={mode === 'technician' ? isBusy : isSelected}
                        aria-label={`${day.weekdayShort} ${day.dayNumber} ${day.monthShort}, ${slot.label} (${slot.shortLabel}): ${cellLabel}`}
                        onClick={() => {
                          if (mode === 'technician') {
                            onToggleSlot?.(key);
                          } else if (!isLockedForCustomer) {
                            onSelectSlot?.(day.isoDate, slot.id);
                          }
                        }}
                        className={`w-full min-h-[42px] rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors inline-flex items-center justify-center gap-1 whitespace-nowrap ${cellClasses}`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                        {(isBooked || (mode === 'customer' && isBusy && !isPast)) && (
                          <Lock className="w-3 h-3 shrink-0 opacity-70" />
                        )}
                        <span>{cellLabel}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Action / Selection Summary */}
      {mode === 'technician' && onSaveSchedule && (
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600 font-mono tabular-nums">
            {hasUnsavedChanges
              ? 'Unsaved schedule changes · Click Save Schedule to publish.'
              : `${busySlots.length} busy slot${busySlots.length === 1 ? '' : 's'} synced to your public profile.`}
          </div>
          <button
            type="button"
            disabled={saving || Boolean(disabledReason)}
            onClick={onSaveSchedule}
            className="min-h-[40px] rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? t.calendar.savingSchedule : hasUnsavedChanges ? t.calendar.saveWeeklySchedule : t.calendar.scheduleSaved}
          </button>
        </div>
      )}

      {mode === 'customer' && (
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-500">{t.calendar.selectedBookingSlot}</span>
          <span className="font-mono tabular-nums font-semibold text-slate-900">
            {selectedDate && selectedSlot
              ? formatSlotDisplay(selectedDate, selectedSlot)
              : t.calendar.tapGreenSlot}
          </span>
        </div>
      )}
    </div>
  );
};
