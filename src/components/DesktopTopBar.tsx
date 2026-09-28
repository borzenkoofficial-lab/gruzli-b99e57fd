import { Search, Bell, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface DesktopTopBarProps {
  title: string;
  subtitle?: string;
  unreadNotifications?: number;
  onSearch?: (q: string) => void;
  onOpenNotifications?: () => void;
  onCreateJob?: () => void;
  showCreateJob?: boolean;
  searchPlaceholder?: string;
}

const Badge = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
};

const DesktopTopBar = ({
  title,
  subtitle,
  unreadNotifications = 0,
  onSearch,
  onOpenNotifications,
  onCreateJob,
  showCreateJob,
  searchPlaceholder = "Поиск по заявкам, людям, чатам...",
}: DesktopTopBarProps) => {
  return (
    <div className="flex items-center gap-4 h-full px-6">
      {/* Page title */}
      <div className="flex flex-col min-w-0 flex-shrink-0">
        <h2 className="text-base font-bold text-foreground truncate leading-tight">{title}</h2>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground truncate leading-tight">{subtitle}</p>
        )}
      </div>

      {/* Search */}
      {onSearch && (
        <div className="flex-1 max-w-xl mx-auto relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-accent/50 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/50 focus:bg-accent transition"
          />
        </div>
      )}
      {!onSearch && <div className="flex-1" />}

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {showCreateJob && onCreateJob && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onCreateJob}
            className="hidden lg:flex items-center gap-1.5 px-3 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-95 transition"
          >
            <Plus size={16} strokeWidth={2.4} />
            Создать
          </motion.button>
        )}
        <button
          onClick={onOpenNotifications}
          className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
          title="Уведомления"
        >
          <Bell size={17} />
          <Badge count={unreadNotifications} />
        </button>
      </div>
    </div>
  );
};

export default DesktopTopBar;
