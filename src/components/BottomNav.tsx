import { Home, ClipboardList, MessageCircle, Users, User, Plus, FolderOpen } from "lucide-react";
import { motion } from "framer-motion";

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
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
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
    <div className="bottom-docked">
      <div className="max-w-lg mx-auto px-3 safe-bottom">
        <div className="rounded-2xl neu-card px-2 py-2">
          <div className="flex items-center justify-around">
            {tabs.map((tab) => {
              const isActive = active === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onNavigate(tab.id)}
                  className={`relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all duration-200 ${
                    isActive ? "neu-inset" : ""
                  }`}
                >
                  <div className="relative">
                    <Icon
                      size={20}
                      className={isActive ? "text-primary" : "text-muted-foreground"}
                    />
                    <Badge count={tab.badge} />
                  </div>
                  <span
                    className={`text-[10px] font-medium ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomNav;
