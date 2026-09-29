import { memo } from "react";

/**
 * Generic shimmer skeleton used as Suspense fallback for lazy-loaded screens.
 * Uses shimmer animation (faster perceived load than a pulse spinner).
 */
const ScreenSkeleton = memo(() => (
  <div className="p-5 space-y-4 animate-fade-in" role="status" aria-label="Загружаем раздел Gruzli" aria-busy="true">
    <div className="h-7 w-32 rounded-xl skeleton-shimmer" />
    <div className="h-4 w-48 rounded-lg skeleton-shimmer" />
    <div className="space-y-3 mt-6" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <div className="h-4 w-3/4 rounded-lg skeleton-shimmer" />
          <div className="h-3 w-1/2 rounded-lg skeleton-shimmer" />
          <div className="h-10 w-full rounded-xl skeleton-shimmer" />
        </div>
      ))}
    </div>
  </div>
));

ScreenSkeleton.displayName = "ScreenSkeleton";

export default ScreenSkeleton;
