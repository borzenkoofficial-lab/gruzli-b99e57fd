import { Home, ClipboardList, MessageCircle, User, FolderOpen } from "lucide-react";

interface BottomNavProps {
  active: string;
  onNavigate: (tab: string) => void;
  isDispatcher?: boolean;
  unreadMessages?: number;
  newJobsCount?: number;
}

const Badge = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none shadow-lg">
      {count > 99 ? "99+" : count}
    </span>
  );
};

const BottomNav = ({ active, onNavigate, isDispatcher, unreadMessages = 0, newJobsCount = 0 }: BottomNavProps) => {
  const workerTabs = [
    { id: "feed", label: "Главная", icon: Home, badge: newJobsCount },
    { id: "orders", label: "Заказы", icon: ClipboardList, badge: 0 },
    { id: "chats", label: "Чаты", icon: MessageCircle, badge: unreadMessages },
    { id: "kartoteka", label: "Картотека", icon: FolderOpen, badge: 0 },
    { id: "profile", label: "Профиль", icon: User, badge: 0 },
  ];

  const dispatcherTabs = [
    { id: "feed", label: "Заявки", icon: ClipboardList, badge: 0 },
    { id: "chats", label: "Чаты", icon: MessageCircle, badge: unreadMessages },
    { id: "kartoteka", label: "Картотека", icon: FolderOpen, badge: 0 },
    { id: "profile", label: "Профиль", icon: User, badge: 0 },
  ];

  const tabs = isDispatcher ? dispatcherTabs : workerTabs;

  return (
    <div className="bottom-nav-wrapper">
      <div className="bottom-nav-pill">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 px-1 rounded-2xl transition-all duration-200 ${
                isActive ? "bottom-nav-active" : ""
              }`}
            >
              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className={`transition-colors duration-200 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                />
                <Badge count={tab.badge} />
              </div>
              <span
                className={`truncate text-[10px] transition-colors duration-200 ${
                  isActive ? "text-primary font-semibold" : "text-muted-foreground font-medium"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
