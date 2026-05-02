import { memo } from "react";
import { ArrowLeft } from "lucide-react";

interface Props {
  onBack?: () => void;
}

/**
 * Polished skeleton for UserProfileScreen.
 * Mirrors the real layout so the perceived loading time feels instant.
 */
const ProfileSkeleton = memo(({ onBack }: Props) => {
  return (
    <div className="min-h-screen bg-background pb-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 safe-top pb-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center"
          aria-label="Назад"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h2 className="text-base font-bold text-foreground flex-1">Профиль</h2>
      </div>

      {/* Avatar + name block */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-4">
          <div
            className="rounded-full skeleton-shimmer"
            style={{ width: 72, height: 72 }}
          />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-2/3 rounded-lg skeleton-shimmer" />
            <div className="h-3 w-1/2 rounded-md skeleton-shimmer" />
            <div className="h-3 w-1/3 rounded-md skeleton-shimmer" />
          </div>
        </div>
      </div>

      {/* ID card */}
      <div className="mx-5 mb-4">
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
          <div className="h-3 w-24 rounded-md skeleton-shimmer" />
          <div className="h-7 w-28 rounded-xl skeleton-shimmer" />
        </div>
      </div>

      {/* Rating card */}
      <div className="mx-5 mb-4">
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-20 rounded-md skeleton-shimmer" />
            <div className="h-5 w-12 rounded-md skeleton-shimmer" />
          </div>
          <div className="space-y-2">
            <div className="h-2 w-full rounded-full skeleton-shimmer" />
            <div className="h-2 w-4/5 rounded-full skeleton-shimmer" />
            <div className="h-2 w-2/3 rounded-full skeleton-shimmer" />
          </div>
        </div>
      </div>

      {/* Skills / reviews placeholders */}
      <div className="mx-5 space-y-3">
        <div className="h-4 w-28 rounded-md skeleton-shimmer" />
        <div className="flex flex-wrap gap-2">
          {[64, 88, 72, 56].map((w, i) => (
            <div key={i} className="h-8 rounded-xl skeleton-shimmer" style={{ width: w }} />
          ))}
        </div>
        <div className="h-24 rounded-2xl skeleton-shimmer mt-4" />
        <div className="h-24 rounded-2xl skeleton-shimmer" />
      </div>
    </div>
  );
});

ProfileSkeleton.displayName = "ProfileSkeleton";

export default ProfileSkeleton;
