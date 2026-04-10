import { Home, ClipboardList, MessageCircle, User, FolderOpen } from "lucide-react";

interface DesktopSidebarProps {
  active: string;
  onNavigate: (tab: string) => void;
  isDispatcher?: boolean;
  unreadMessages?: number;
  newJobsCount?: number;
}

const Badge = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
};

const DesktopSidebar = ({ active, onNavigate, isDispatcher, unreadMessages = 0, newJobsCount = 0 }: DesktopSidebarProps) => {
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
    <aside className="desktop-sidebar">
      <div className="px-5 py-6 mb-2">
        <h1 className="text-xl font-bold text-primary tracking-tight">Gruzli</h1>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium w-full text-left ${
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="flex-1">{tab.label}</span>
              <Badge count={tab.badge} />
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default DesktopSidebar;
