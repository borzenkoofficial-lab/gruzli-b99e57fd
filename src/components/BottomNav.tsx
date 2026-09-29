import { memo } from "react";
import { Home, ClipboardList, MessageCircle, User, FolderOpen, Command } from "lucide-react";

interface BottomNavProps {
  active: string;
  onNavigate: (tab: string) => void;
  isDispatcher?: boolean;
  isClient?: boolean;
  unreadMessages?: number;
  newJobsCount?: number;
}

const Badge = memo(({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#17181b] text-white text-[10px] font-bold leading-none shadow-sm" aria-label={`${count} непрочитанных`}>
      {count > 99 ? "99+" : count}
    </span>
  );
});
Badge.displayName = "Badge";

const BottomNav = memo(({ active, onNavigate, isDispatcher, isClient, unreadMessages = 0, newJobsCount = 0 }: BottomNavProps) => {
  const workerTabs = [
    { id: "feed", label: "Главная", icon: Home, badge: newJobsCount },
    { id: "orders", label: "Заказы", icon: ClipboardList, badge: 0 },
    { id: "chats", label: "Чаты", icon: MessageCircle, badge: unreadMessages },
    { id: "kartoteka", label: "Картотека", icon: FolderOpen, badge: 0 },
    { id: "profile", label: "Профиль", icon: User, badge: 0 },
  ];

  const dispatcherTabs = [
    { id: "feed", label: "Работа", icon: Home, badge: newJobsCount },
    { id: "chats", label: "Чаты", icon: MessageCircle, badge: unreadMessages },
    { id: "kartoteka", label: "Картотека", icon: FolderOpen, badge: 0 },
    { id: "profile", label: "Профиль", icon: User, badge: 0 },
  ];

  const clientTabs = [
    { id: "feed", label: "Заказать", icon: Home, badge: 0 },
    { id: "orders", label: "Заявки", icon: ClipboardList, badge: 0 },
    { id: "chats", label: "Чаты", icon: MessageCircle, badge: unreadMessages },
    { id: "profile", label: "Профиль", icon: User, badge: 0 },
  ];

  const tabs = isClient ? clientTabs : isDispatcher ? dispatcherTabs : workerTabs;

  return (
    <button type="button" className="gruzli-os-mini-trigger" onClick={() => window.dispatchEvent(new Event("gruzli-open-os"))} aria-label="Открыть Gruzli OS"><Command size={16}/></button>\n    <nav className="bottom-nav-wrapper" role="navigation" aria-label="Основная навигация">
      <div className="bottom-nav-pill native-surface" role="tablist" aria-label="Разделы Gruzli">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              role="tab"
              aria-selected={isActive}
              aria-label={`${tab.label}${tab.badge > 0 ? `, ${tab.badge} новых` : ""}`}
              className={`native-press relative flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl transition-all duration-200 ${
                isActive ? "bottom-nav-active" : ""
              }`}
            >
              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.2 : 1.6}
                  className={`transition-colors duration-150 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                />
                <Badge count={tab.badge} />
              </div>
              <span
                className={`truncate text-[10px] transition-colors duration-150 ${
                  isActive ? "text-foreground font-semibold" : "text-muted-foreground font-medium"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});
BottomNav.displayName = "BottomNav";

export default BottomNav;
