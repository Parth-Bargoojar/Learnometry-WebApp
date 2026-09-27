/* Route-level skeleton (DS §24): the page's shape, never a bare spinner. */
export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-4 w-64 lg:col-span-12" />
      <div className="skeleton h-56 lg:col-span-8" />
      <div className="skeleton h-56 lg:col-span-4" />
      <div className="skeleton h-72 lg:col-span-12" />
    </div>
  );
}
