import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isBefore, startOfToday } from 'date-fns';
import styles from './DatePicker.module.css';

export interface DatePickerProps {
  label?: string;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  selectedDate,
  onSelectDate,
  minDate = startOfToday(),
  maxDate,
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(selectedDate || new Date());

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const rows = [];
  let days = [];
  let day = startDate;

  const today = startOfToday();

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      const cloneDay = day;
      const isSelected = selectedDate ? isSameDay(cloneDay, selectedDate) : false;
      const isCurrentMonth = isSameMonth(cloneDay, monthStart);
      const isToday = isSameDay(cloneDay, today);
      const isDisabled = (minDate && isBefore(cloneDay, minDate)) || (maxDate && isBefore(maxDate, cloneDay));

      days.push(
        <button
          key={cloneDay.toISOString()}
          type="button"
          disabled={isDisabled}
          onClick={() => !isDisabled && onSelectDate(cloneDay)}
          className={`
            ${styles.dayBtn} 
            ${!isCurrentMonth ? styles.disabledDay : ''} 
            ${isSelected ? styles.selectedDay : ''} 
            ${isToday ? styles.todayDay : ''} 
            ${isDisabled ? styles.disabledDay : ''}
          `}
        >
          {format(cloneDay, 'd')}
        </button>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div key={day.toISOString()} className={styles.daysGrid}>
        {days}
      </div>
    );
    days = [];
  }

  return (
    <div className={styles.container}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.pickerBox}>
        <div className={styles.header}>
          <button type="button" onClick={prevMonth} className={styles.navBtn} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <div className={styles.monthTitle}>
            <CalendarIcon size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
            {format(currentMonth, 'MMMM yyyy')}
          </div>
          <button type="button" onClick={nextMonth} className={styles.navBtn} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className={styles.daysGrid} style={{ marginBottom: 6 }}>
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
            <div key={d} className={styles.dayName}>
              {d}
            </div>
          ))}
        </div>

        {rows}
      </div>
    </div>
  );
};

export interface TimeSlot {
  id: string;
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "10:30"
  available: boolean;
  statusLabel?: string;
}

export interface TimeSlotPickerProps {
  label?: string;
  slots: TimeSlot[];
  selectedSlotId: string | null;
  onSelectSlot: (slot: TimeSlot) => void;
}

export const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({
  label,
  slots,
  selectedSlotId,
  onSelectSlot,
}) => {
  return (
    <div className={styles.container}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.slotGrid}>
        {slots.map((slot) => {
          const isSelected = selectedSlotId === slot.id;
          const isBooked = !slot.available;

          return (
            <button
              key={slot.id}
              type="button"
              disabled={isBooked}
              onClick={() => onSelectSlot(slot)}
              className={`
                ${styles.slotBtn} 
                ${isSelected ? styles.selectedSlot : ''} 
                ${isBooked ? styles.bookedSlot : ''}
              `}
            >
              <span>{slot.startTime} – {slot.endTime}</span>
              <span className={styles.slotStatus}>
                {isBooked ? (slot.statusLabel || 'Reserved') : isSelected ? 'Selected' : 'Available'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
