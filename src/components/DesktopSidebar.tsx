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
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface DesktopSidebarProps {
  active: string;
  onNavigate: (tab: string) => void;
  isDispatcher?: boolean;
  isClient?: boolean;
  unreadMessages?: number;
  newJobsCount?: number;
  onOpenNotifications?: () => void;
  onOpenPremium?: () => void;
  onOpenSupport?: () => void;
  onOpenSettings?: () => void;
  onOpenCommunity?: () => void;
  onOpenProfile?: () => void;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

const Badge = ({ count }: { count: number }) =>
  count > 0 ? (
    <span className="desktop-nav-badge" aria-label={`${count} новых`}>
      {count > 99 ? "99+" : count}
    </span>
  ) : null;

const DesktopSidebar = ({
  active,
  onNavigate,
  isDispatcher = false,
  isClient = false,
  unreadMessages = 0,
  newJobsCount = 0,
  onOpenNotifications,
  onOpenPremium,
  onOpenSupport,
  onOpenSettings,
  onOpenCommunity,
  onOpenProfile,
}: DesktopSidebarProps) => {
  const { profile, signOut } = useAuth();

  const workerItems: NavigationItem[] = [
    { id: "feed", label: "Лента", icon: Home, badge: newJobsCount },
    { id: "orders", label: "Мои заказы", icon: ClipboardList },
    { id: "chats", label: "Сообщения", icon: MessageCircle, badge: unreadMessages },
    { id: "kartoteka", label: "Картотека", icon: FolderOpen },
  ];

  const dispatcherItems: NavigationItem[] = [
    { id: "feed", label: "Рабочий стол", icon: Briefcase },
    { id: "chats", label: "Сообщения", icon: MessageCircle, badge: unreadMessages },
    { id: "kartoteka", label: "Картотека", icon: FolderOpen },
  ];

  const clientItems: NavigationItem[] = [
    { id: "feed", label: "Новый заказ", icon: Plus },
    { id: "orders", label: "Мои заказы", icon: ClipboardList },
    { id: "chats", label: "Сообщения", icon: MessageCircle, badge: unreadMessages },
  ];

  const navigationItems = isClient
    ? clientItems
    : isDispatcher
      ? dispatcherItems
      : workerItems;

  const fullName =
    profile?.full_name ||
    (isClient ? "Заказчик" : isDispatcher ? "Диспетчер" : "Грузчик");

  const initials =
    fullName
      .split(" ")
      .map((word: string) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const renderNavigationItem = (item: NavigationItem) => {
    const Icon = item.icon;
    const isActive = active === item.id;

    return (
      <button
        key={item.id}
        type="button"
        aria-label={item.label}
        title={item.label}
        aria-current={isActive ? "page" : undefined}
        onClick={() => onNavigate(item.id)}
        className={`desktop-nav-item ${isActive ? "is-active" : ""}`}
      >
        <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
        <span>{item.label}</span>
        <Badge count={item.badge ?? 0} />
      </button>
    );
  };

  const renderServiceAction = (
    label: string,
    Icon: LucideIcon,
    onClick?: () => void,
  ) =>
    onClick ? (
      <button
        key={label}
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        className="desktop-nav-item"
      >
        <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
        <span>{label}</span>
      </button>
    ) : null;

  return (
    <aside className="desktop-sidebar" aria-label="Главная навигация Gruzli">
      <div className="desktop-brand" aria-label="Gruzli">
        <div className="desktop-brand-mark" aria-hidden="true">
          G
        </div>
        <div>
          <div className="desktop-brand-name">Gruzli</div>
          <div className="desktop-brand-role">
            {isClient ? "Заказчик" : isDispatcher ? "Диспетчер" : "Грузчик"}
          </div>
        </div>
      </div>

      <div className="desktop-sidebar-section">
        <div className="desktop-section-label">Рабочая область</div>
        <nav className="desktop-nav" aria-label="Рабочая область">
          {navigationItems.map(renderNavigationItem)}
        </nav>
      </div>

      <div className="desktop-sidebar-section desktop-sidebar-service">
        <div className="desktop-section-label">Сервис</div>
        <nav className="desktop-nav" aria-label="Сервис">
          {isDispatcher &&
            renderServiceAction("Сообщество", Users, onOpenCommunity)}
          {renderServiceAction("Уведомления", Bell, onOpenNotifications)}
          {renderServiceAction("Premium", Crown, onOpenPremium)}
          {renderServiceAction("Поддержка", HelpCircle, onOpenSupport)}
          {renderServiceAction("Настройки", Settings, onOpenSettings)}
        </nav>
      </div>

      <div className="desktop-sidebar-footer">
        <button
          type="button"
          className={`desktop-profile-card ${active === "profile" ? "is-active" : ""}`}
          onClick={onOpenProfile}
          aria-label={`Открыть профиль: ${fullName}`}
          title={fullName}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" />
          ) : (
            <span className="desktop-avatar" aria-hidden="true">
              {initials}
            </span>
          )}
          <span className="desktop-profile-copy">
            <strong>{fullName}</strong>
            <small>
              {isClient
                ? "Кабинет заказчика"
                : isDispatcher
                  ? "Кабинет диспетчера"
                  : "Профиль"}
            </small>
          </span>
          <User size={16} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="desktop-logout"
          onClick={() => void signOut()}
        >
          <LogOut size={15} aria-hidden="true" />
          Выйти
        </button>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
