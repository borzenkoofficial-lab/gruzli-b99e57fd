import { Home, ClipboardList, MessageCircle, Users, User } from "lucide-react";
import { motion } from "framer-motion";

interface BottomNavProps {
  active: string;
  onNavigate: (tab: string) => void;
}

const tabs = [
  { id: "feed", label: "Главная", icon: Home },
  { id: "orders", label: "Заказы", icon: ClipboardList },
  { id: "chats", label: "Чаты", icon: MessageCircle, badge: 3 },
  { id: "dispatchers", label: "Диспетчеры", icon: Users },
  { id: "profile", label: "Профиль", icon: User },
];

const BottomNav = ({ active, onNavigate }: BottomNavProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface-2 border-t border-border/50 backdrop-blur-xl">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2 px-2">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className="relative flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors"
            >
              <div className="relative">
                <Icon
                  size={22}
                  className={isActive ? "text-primary" : "text-muted-foreground"}
                />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-badge text-[10px] font-bold flex items-center justify-center text-foreground">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-0.5 w-8 h-0.5 rounded-full gradient-cyan"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
};

export default BottomNav;
