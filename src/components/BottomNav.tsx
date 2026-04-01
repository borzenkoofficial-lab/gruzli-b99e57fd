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
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-lg mx-auto">
        <div className="mx-3 mb-3 rounded-2xl neu-card px-2 py-2">
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
                    {tab.badge && (
                      <span className="absolute -top-1.5 -right-2.5 w-4 h-4 rounded-full gradient-primary text-[9px] font-bold flex items-center justify-center text-primary-foreground">
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
