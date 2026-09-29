import { motion } from "framer-motion";
import {
  Home,
  ClipboardList,
  MessageCircle,
  User,
  FolderOpen,
  Plus,
  Bell,
  Crown,
  HelpCircle,
  Settings,
  LogOut,
  Briefcase,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface DesktopSidebarProps {
  active: string;
  onNavigate: (tab: string) => void;
  isDispatcher?: boolean;
  unreadMessages?: number;
  newJobsCount?: number;
  onCreateJob?: () => void;
  onOpenNotifications?: () => void;
  onOpenPremium?: () => void;
  onOpenSupport?: () => void;
  onOpenSettings?: () => void;
  onOpenCommunity?: () => void;
  onOpenProfile?: () => void;
}

const Badge = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
};

const DesktopSidebar = ({
  active,
  onNavigate,
  isDispatcher,
  unreadMessages = 0,
  newJobsCount = 0,
  onCreateJob,
  onOpenNotifications,
  onOpenPremium,
  onOpenSupport,
  onOpenSettings,
  onOpenCommunity,
  onOpenProfile,
}: DesktopSidebarProps) => {
  const { profile, signOut } = useAuth();

  const workerTabs = [
    { id: "feed", label: "Лента заявок", icon: Home, badge: newJobsCount },
    { id: "orders", label: "Мои заказы", icon: ClipboardList, badge: 0 },
    { id: "chats", label: "Сообщения", icon: MessageCircle, badge: unreadMessages },
    { id: "kartoteka", label: "Картотека", icon: FolderOpen, badge: 0 },
  ];

  const dispatcherTabs = [
    { id: "feed", label: "Мои заявки", icon: Briefcase, badge: 0 },
    { id: "chats", label: "Сообщения", icon: MessageCircle, badge: unreadMessages },
    { id: "kartoteka", label: "Картотека", icon: FolderOpen, badge: 0 },
  ];

  const tabs = isDispatcher ? dispatcherTabs : workerTabs;

  const fullName = profile?.full_name || (isDispatcher ? "Диспетчер" : "Грузчик");
  const initials =
    fullName
      .split(" ")
      .map((w: string) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const NavItem = ({
    icon: Icon,
    label,
    onClick,
    isActive,
    badge,
  }: {
    icon: typeof Home;
    label: string;
    onClick: () => void;
    isActive?: boolean;
    badge?: number;
  }) => (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 text-sm font-medium w-full text-left group ${
        isActive
          ? "bg-primary/15 text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      }`}
    >
      <Icon
        size={19}
        strokeWidth={isActive ? 2.2 : 1.7}
        className={isActive ? "text-[#8a6b00]" : ""}
      />
      <span className="flex-1 truncate">{label}</span>
      {badge ? <Badge count={badge} /> : null}
    </motion.button>
  );

  return (
    <aside className="desktop-sidebar">
      {/* Brand */}
      <div className="px-5 pt-6 pb-4 flex items-center gap-2 gruzli-brand-lockup">
        <div className="w-9 h-9 rounded-xl bg-[#17181b] flex items-center justify-center shadow-[0_8px_20px_rgba(18,20,25,.14)]">
          <span className="text-white font-black text-base tracking-[-.04em]">G</span>
        </div>
        <div className="flex flex-col">
          <h1 className="text-base font-bold text-foreground tracking-[-.035em] leading-none">Gruzli</h1>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
            {isDispatcher ? "Диспетчер" : "Грузчик"}
          </span>
        </div>
      </div>

      {/* Primary nav */}
      <div className="px-3 mt-2">
        <p className="px-3 mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
          Навигация
        </p>
        <nav className="flex flex-col gap-0.5">
          {tabs.map((tab) => (
            <NavItem
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              isActive={active === tab.id}
              badge={tab.badge}
              onClick={() => onNavigate(tab.id)}
            />
          ))}
        </nav>
      </div>

      {/* Secondary actions */}
      <div className="px-3 mt-5">
        <p className="px-3 mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
          Сервис
        </p>
        <nav className="flex flex-col gap-0.5">
          {isDispatcher && onOpenCommunity && (
            <NavItem icon={Users} label="Сообщество" onClick={onOpenCommunity} />
          )}
          <NavItem icon={Bell} label="Уведомления" onClick={() => onOpenNotifications?.()} />
          <NavItem icon={Crown} label="Premium" onClick={() => onOpenPremium?.()} />
          <NavItem icon={HelpCircle} label="Поддержка" onClick={() => onOpenSupport?.()} />
          <NavItem icon={Settings} label="Настройки" onClick={() => onOpenSettings?.()} />
        </nav>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User card / profile */}
      <div className="px-3 pb-3 pt-3 border-t border-border/60">
        <div
          onClick={() => onOpenProfile?.()}
          role="button"
          tabIndex={0}
          className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-accent/60 cursor-pointer transition"
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="w-9 h-9 rounded-full object-cover ring-1 ring-border"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/70 to-primary/30 flex items-center justify-center text-primary-foreground text-xs font-bold">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate leading-tight">
              {fullName}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {isDispatcher ? "Кабинет диспетчера" : "Профиль"}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              signOut();
            }}
            title="Выйти"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/80 transition"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
