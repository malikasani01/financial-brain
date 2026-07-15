/**
 * A minimal chainable Supabase mock for server-action tests. Records every
 * insert / update / upsert / delete, and resolves reads via an optional
 * resolver keyed by (table, method). Awaiting a builder that ends without
 * single()/maybeSingle() resolves to { data: [], error: null }.
 */

export type ReadMethod = 'single' | 'maybeSingle' | 'await';
export type Resolver = (table: string, method: ReadMethod) => { data: unknown; error: unknown };

export interface RecordedCall {
  table: string;
  values?: Record<string, unknown>;
}

export interface MockSupabase {
  supabase: { from: (table: string) => unknown };
  calls: {
    inserts: RecordedCall[];
    updates: RecordedCall[];
    upserts: RecordedCall[];
    deletes: RecordedCall[];
  };
}

const defaultResolver: Resolver = (table, method) => {
  if (method === 'single') return { data: { id: `${table}-id` }, error: null };
  if (method === 'maybeSingle') return { data: null, error: null };
  return { data: [], error: null };
};

export function makeSupabase(resolver: Resolver = defaultResolver): MockSupabase {
  const calls: MockSupabase['calls'] = { inserts: [], updates: [], upserts: [], deletes: [] };

  function chain(table: string) {
    const c: Record<string, unknown> = {
      insert(v: Record<string, unknown>) {
        calls.inserts.push({ table, values: v });
        return c;
      },
      upsert(v: Record<string, unknown>) {
        calls.upserts.push({ table, values: v });
        return c;
      },
      update(v: Record<string, unknown>) {
        calls.updates.push({ table, values: v });
        return c;
      },
      delete() {
        calls.deletes.push({ table });
        return c;
      },
      select: () => c,
      eq: () => c,
      is: () => c,
      order: () => c,
      limit: () => c,
      maybeSingle: () => Promise.resolve(resolver(table, 'maybeSingle')),
      single: () => Promise.resolve(resolver(table, 'single')),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(resolver(table, 'await')).then(res, rej),
    };
    return c;
  }

  return { supabase: { from: (table: string) => chain(table) }, calls };
}
