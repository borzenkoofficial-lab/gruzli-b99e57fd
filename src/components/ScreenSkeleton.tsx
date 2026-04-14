import { memo } from "react";

const ScreenSkeleton = memo(() => (
  <div className="p-5 space-y-4 animate-pulse">
    <div className="h-7 w-32 rounded-xl bg-muted/40" />
    <div className="h-4 w-48 rounded-lg bg-muted/30" />
    <div className="space-y-3 mt-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <div className="h-4 w-3/4 rounded-lg bg-muted/30" />
          <div className="h-3 w-1/2 rounded-lg bg-muted/20" />
          <div className="h-10 w-full rounded-xl bg-muted/20" />
        </div>
      ))}
    </div>
  </div>
));

ScreenSkeleton.displayName = "ScreenSkeleton";

export default ScreenSkeleton;
