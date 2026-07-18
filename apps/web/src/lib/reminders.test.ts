import { describe, expect, it } from 'vitest';
import {
  attentionCount,
  attentionReminders,
  groupReminders,
  isDueSoon,
  reminderTiming,
  type ReminderRow,
} from './reminders';

const TODAY = '2026-07-18';

function r(partial: Partial<ReminderRow>): ReminderRow {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    title: partial.title ?? 'Reminder',
    description: null,
    transcription: null,
    due_date: partial.due_date ?? null,
    due_time: null,
    timezone: null,
    category: partial.category ?? null,
    priority: partial.priority ?? 'NORMAL',
    status: partial.status ?? 'OPEN',
    recurrence_rule: 'NONE',
    notification_preferences: null,
    related_entity_type: null,
    related_entity_id: null,
    completed_at: partial.completed_at ?? null,
  };
}

describe('reminderTiming', () => {
  it('classifies an open reminder by its due date', () => {
    expect(reminderTiming(r({ due_date: '2026-07-10' }), TODAY)).toBe('overdue');
    expect(reminderTiming(r({ due_date: TODAY }), TODAY)).toBe('today');
    expect(reminderTiming(r({ due_date: '2026-08-01' }), TODAY)).toBe('upcoming');
  });

  it('is "none" for undated or non-open reminders', () => {
    expect(reminderTiming(r({ due_date: null }), TODAY)).toBe('none');
    expect(reminderTiming(r({ due_date: '2026-07-10', status: 'COMPLETED' }), TODAY)).toBe('none');
    expect(reminderTiming(r({ due_date: '2026-07-10', status: 'CANCELED' }), TODAY)).toBe('none');
  });
});

describe('isDueSoon', () => {
  it('is true within the window but not today/overdue', () => {
    expect(isDueSoon(r({ due_date: '2026-07-20' }), TODAY)).toBe(true); // +2 days
    expect(isDueSoon(r({ due_date: '2026-07-21' }), TODAY)).toBe(true); // +3 days (inclusive)
    expect(isDueSoon(r({ due_date: '2026-07-22' }), TODAY)).toBe(false); // +4 days
    expect(isDueSoon(r({ due_date: TODAY }), TODAY)).toBe(false); // today
    expect(isDueSoon(r({ due_date: '2026-07-01' }), TODAY)).toBe(false); // overdue
  });

  it('crosses month boundaries correctly', () => {
    expect(isDueSoon(r({ due_date: '2026-08-01' }), '2026-07-30')).toBe(true); // +2 days
  });
});

describe('groupReminders', () => {
  it('splits into sections and puts completed + canceled together', () => {
    const rows = [
      r({ id: 'o', due_date: '2026-07-10' }),
      r({ id: 't', due_date: TODAY }),
      r({ id: 'u', due_date: '2026-08-01' }),
      r({ id: 'n', due_date: null }),
      r({ id: 'c', due_date: '2026-07-10', status: 'COMPLETED' }),
      r({ id: 'x', due_date: null, status: 'CANCELED' }),
    ];
    const s = groupReminders(rows, TODAY);
    expect(s.overdue.map((x) => x.id)).toEqual(['o']);
    expect(s.today.map((x) => x.id)).toEqual(['t']);
    expect(s.upcoming.map((x) => x.id)).toEqual(['u']);
    expect(s.noDate.map((x) => x.id)).toEqual(['n']);
    expect(s.completed.map((x) => x.id).sort()).toEqual(['c', 'x']);
  });
});

describe('attentionCount', () => {
  it('counts only overdue and due-today open reminders', () => {
    const rows = [
      r({ due_date: '2026-07-10' }), // overdue
      r({ due_date: TODAY }), // today
      r({ due_date: '2026-08-01' }), // upcoming — excluded
      r({ due_date: '2026-07-10', status: 'COMPLETED' }), // done — excluded
      r({ due_date: null }), // no date — excluded
    ];
    expect(attentionCount(rows, TODAY)).toBe(2);
  });
});

describe('attentionReminders', () => {
  it('ranks overdue, then today, then high-priority upcoming, capped', () => {
    const rows = [
      r({ id: 'up-normal', due_date: '2026-08-01', priority: 'NORMAL' }), // excluded (normal upcoming)
      r({ id: 'up-high', due_date: '2026-08-02', priority: 'HIGH' }),
      r({ id: 'today', due_date: TODAY }),
      r({ id: 'overdue', due_date: '2026-07-10' }),
    ];
    const top = attentionReminders(rows, TODAY, 3);
    expect(top.map((x) => x.id)).toEqual(['overdue', 'today', 'up-high']);
  });
});
