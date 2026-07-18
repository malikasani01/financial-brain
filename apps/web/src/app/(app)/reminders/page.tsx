import Link from 'next/link';
import { getSessionContext } from '@/lib/session';
import { listOwn } from '@/lib/db';
import {
  groupReminders,
  isDueSoon,
  listReminders,
  reminderTiming,
  type ReminderEntityType,
  type ReminderRow,
} from '@/lib/reminders';
import { Icon } from '@/components/Icon';
import { ReminderForm } from '@/components/ReminderForm';
import { ReminderRow as Row } from '@/components/ReminderRow';
import type { RelatedOption } from '@/lib/reminder-options';
import { createReminder } from '@/app/actions/reminders';

export const dynamic = 'force-dynamic';

type FilterKey = 'all' | 'open' | 'overdue' | 'today' | 'upcoming' | 'completed';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
];

const SECTION_TITLE: Record<string, string> = {
  overdue: 'Overdue',
  today: 'Today',
  upcoming: 'Upcoming',
  noDate: 'No date',
  completed: 'Completed',
};

function AddButton({ relatedOptions }: { relatedOptions: RelatedOption[] }) {
  return (
    <ReminderForm action={createReminder} title="New reminder" relatedOptions={relatedOptions}>
      <span className="flex items-center justify-center gap-2 rounded-button bg-violet500 px-5 py-3.5 font-bold text-white shadow-card">
        <Icon name="plus" size={20} />
        Add reminder
      </span>
    </ReminderForm>
  );
}

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; c?: string }>;
}) {
  const [{ f, c }, { clock }, reminders, subRows, oblRows, acctRows, goalRows, bizRows] =
    await Promise.all([
      searchParams,
      getSessionContext(),
      listReminders(),
      listOwn('subscriptions', 'id,name'),
      listOwn('obligations', 'id,name'),
      listOwn('accounts', 'id,name'),
      listOwn('goals', 'id,name'),
      listOwn('businesses', 'id,name'),
    ]);
  const today = clock.today;

  const filter = (FILTERS.find((x) => x.key === f)?.key ?? 'all') as FilterKey;

  // Names for linked financial items, keyed by entity type.
  const nameMaps: Record<ReminderEntityType, Map<string, string>> = {
    subscription: new Map(subRows.map((r) => [r.id, String(r.name)])),
    obligation: new Map(oblRows.map((r) => [r.id, String(r.name)])),
    account: new Map(acctRows.map((r) => [r.id, String(r.name)])),
    goal: new Map(goalRows.map((r) => [r.id, String(r.name)])),
    business: new Map(bizRows.map((r) => [r.id, String(r.name)])),
  };
  const linkedLabel = (r: ReminderRow): string | null =>
    r.related_entity_type && r.related_entity_id
      ? (nameMaps[r.related_entity_type]?.get(r.related_entity_id) ?? null)
      : null;

  // Options for the "link to a financial item" picker (value = "type:id").
  const TYPE_LABEL: Record<ReminderEntityType, string> = {
    subscription: 'Subscription',
    obligation: 'Obligation',
    account: 'Account',
    goal: 'Goal',
    business: 'Business',
  };
  const relatedOptions: RelatedOption[] = (Object.keys(nameMaps) as ReminderEntityType[]).flatMap(
    (type) =>
      [...nameMaps[type].entries()].map(([id, name]) => ({
        value: `${type}:${id}`,
        label: `${name} (${TYPE_LABEL[type]})`,
      })),
  );

  // Optional category filter (?c=), then group.
  const scoped = c ? reminders.filter((r) => r.category === c) : reminders;
  const sections = groupReminders(scoped, today);
  const usedCategories = [...new Set(reminders.map((r) => r.category).filter(Boolean))] as string[];

  // Which sections this filter shows.
  const visibleKeys: (keyof typeof sections)[] =
    filter === 'completed'
      ? ['completed']
      : filter === 'overdue'
        ? ['overdue']
        : filter === 'today'
          ? ['today']
          : filter === 'upcoming'
            ? ['upcoming']
            : filter === 'open'
              ? ['overdue', 'today', 'upcoming', 'noDate']
              : ['overdue', 'today', 'upcoming', 'noDate', 'completed'];

  const hasAny = reminders.length > 0;
  const shownCount = visibleKeys.reduce((n, k) => n + sections[k].length, 0);

  const chipHref = (key: FilterKey) => {
    const params = new URLSearchParams();
    if (key !== 'all') params.set('f', key);
    if (c) params.set('c', c);
    const q = params.toString();
    return q ? `/reminders?${q}` : '/reminders';
  };

  return (
    <main className="mx-auto max-w-md px-6 py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-button bg-violet100 text-violet600">
          <Icon name="bell" size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-ink900">Financial Reminders</h1>
          <p className="text-sm text-ink600">
            Keep track of the small financial tasks that protect your money.
          </p>
        </div>
      </div>

      {/* Quick-add area */}
      <div className="mt-5">
        <AddButton relatedOptions={relatedOptions} />
      </div>

      {!hasAny ? (
        <div className="mt-10 rounded-card bg-white p-8 text-center shadow-card">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-violet100 text-violet600">
            <Icon name="bell" size={28} />
          </span>
          <p className="mt-4 font-bold text-ink900">Nothing to remember right now.</p>
          <p className="mt-1 text-sm text-ink600">
            Add a financial task by typing it or saying it out loud.
          </p>
          <div className="mt-5">
            <AddButton relatedOptions={relatedOptions} />
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="mt-5 -mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
            {FILTERS.map((x) => (
              <Link
                key={x.key}
                href={chipHref(x.key)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold ${
                  filter === x.key ? 'bg-violet500 text-white' : 'bg-white text-ink600 shadow-card'
                }`}
              >
                {x.label}
              </Link>
            ))}
          </div>

          {/* Category filter (only when the user has used categories) */}
          {usedCategories.length > 0 && (
            <div className="mt-2 -mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
              <Link
                href={f ? `/reminders?f=${f}` : '/reminders'}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                  !c ? 'bg-ink900 text-white' : 'bg-line text-ink600'
                }`}
              >
                All categories
              </Link>
              {usedCategories.map((cat) => {
                const params = new URLSearchParams();
                if (f) params.set('f', f);
                params.set('c', cat);
                return (
                  <Link
                    key={cat}
                    href={`/reminders?${params.toString()}`}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                      c === cat ? 'bg-ink900 text-white' : 'bg-line text-ink600'
                    }`}
                  >
                    {cat}
                  </Link>
                );
              })}
            </div>
          )}

          {shownCount === 0 ? (
            <p className="mt-10 text-center text-sm text-ink600">Nothing here.</p>
          ) : (
            <div className="mt-4 space-y-6">
              {visibleKeys.map((key) => {
                const items = sections[key];
                if (items.length === 0) return null; // don't show empty sections
                return (
                  <section key={key}>
                    <h2 className="text-xs font-bold uppercase tracking-wide text-ink600">
                      {SECTION_TITLE[key]}{' '}
                      <span className="text-ink600/70">{items.length}</span>
                    </h2>
                    <div className="mt-2 divide-y divide-line rounded-card bg-white px-4 shadow-card">
                      {items.map((r) => (
                        <Row
                          key={r.id}
                          reminder={r}
                          timing={reminderTiming(r, today)}
                          dueSoon={isDueSoon(r, today)}
                          linkedLabel={linkedLabel(r)}
                          relatedOptions={relatedOptions}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
