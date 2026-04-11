import { motion } from "framer-motion";
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
    <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-foreground text-background text-[10px] font-bold leading-none">
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
        <h1 className="text-xl font-bold text-foreground tracking-tight">Gruzli</h1>
      </div>
      <nav className="flex flex-col gap-0.5 px-3">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150 text-sm font-medium w-full text-left ${
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2 : 1.6} />
              <span className="flex-1">{tab.label}</span>
              <Badge count={tab.badge} />
            </motion.button>
          );
        })}
      </nav>
    </aside>
  );
};

export default DesktopSidebar;
