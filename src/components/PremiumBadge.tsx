import { Crown } from "lucide-react";

interface PremiumBadgeProps {
  size?: number;
  className?: string;
}

const PremiumBadge = ({ size = 14, className = "" }: PremiumBadgeProps) => (
  <span className={`inline-flex items-center gap-0.5 ${className}`}>
    <Crown size={size} className="text-yellow-500 fill-yellow-500" />
  </span>
);

/** Glowing avatar ring for premium users */
export const PremiumAvatarRing = ({
  isPremium,
  children,
  className = "",
}: {
  isPremium: boolean;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`relative ${className}`}>
    {isPremium && (
      <div className="absolute -inset-[3px] rounded-full bg-gradient-to-tr from-yellow-400 via-amber-500 to-orange-500 animate-pulse opacity-80" />
    )}
    <div className="relative">{children}</div>
  </div>
);

export default PremiumBadge;
