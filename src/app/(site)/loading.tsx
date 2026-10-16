/** Shown instantly while a page loads, so navigation feels immediate. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-shell animate-pulse space-y-4 px-4 py-6 sm:px-6" role="status" aria-label="Loading">
      <div className="h-40 rounded-2xl bg-line/60 sm:h-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-44 rounded-2xl bg-line/50" />)}
      </div>
    </div>
  );
}
