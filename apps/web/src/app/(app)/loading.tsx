/**
 * Instant skeleton shown while an app tab's data loads, so switching tabs feels
 * immediate instead of leaving the old screen frozen. The sidebar and bottom
 * nav (in the (app) layout) stay put — only this page area swaps.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-md animate-pulse px-6 py-8" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-button bg-line" />
          <div className="space-y-1">
            <div className="h-3 w-32 rounded bg-line" />
            <div className="h-2.5 w-16 rounded bg-line" />
          </div>
        </div>
        <div className="h-6 w-6 rounded-full bg-line" />
      </div>

      {/* Hero card */}
      <div className="mt-5 rounded-card bg-white p-6 shadow-card">
        <div className="h-3 w-28 rounded bg-line" />
        <div className="mt-2 h-10 w-40 rounded bg-violet100" />
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4">
          <div className="h-8 rounded bg-line" />
          <div className="h-8 rounded bg-line" />
          <div className="h-8 rounded bg-line" />
        </div>
      </div>

      {/* A couple of list cards */}
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-card bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-40 rounded bg-line" />
              <div className="h-3.5 w-16 rounded bg-line" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
