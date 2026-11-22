import { useEffect, useRef } from "react";
import { Search, Bell, Plus } from "lucide-react";

interface DesktopTopBarProps {
  title: string;
  subtitle?: string;
  unreadNotifications?: number;
  onSearch?: (query: string) => void;
  onOpenNotifications?: () => void;
  onCreateJob?: () => void;
  showCreateJob?: boolean;
  searchPlaceholder?: string;
}

const DesktopTopBar = ({
  title,
  subtitle,
  unreadNotifications = 0,
  onSearch,
  onOpenNotifications,
  onCreateJob,
  showCreateJob = false,
  searchPlaceholder = "Поиск по заявкам, людям, чатам...",
}: DesktopTopBarProps) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!onSearch) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (
        event.key === "Escape" &&
        document.activeElement === searchInputRef.current
      ) {
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSearch]);

  return (
    <div className="desktop-topbar-inner">
      <div className="desktop-page-heading">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>

      {onSearch && (
        <label className="desktop-search">
          <Search size={16} aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            aria-label="Поиск"
            placeholder={searchPlaceholder}
            onChange={(event) => onSearch(event.target.value)}
          />
          <kbd>Ctrl/⌘ K</kbd>
        </label>
      )}

      <div className="desktop-top-actions">
        {showCreateJob && onCreateJob && (
          <button
            type="button"
            className="desktop-primary-action"
            onClick={onCreateJob}
          >
            <Plus size={16} aria-hidden="true" />
            Создать заказ
          </button>
        )}

        <button
          type="button"
          className="desktop-icon-button desktop-notification"
          onClick={onOpenNotifications}
          aria-label="Уведомления"
          title="Уведомления"
        >
          <Bell size={17} aria-hidden="true" />
          {unreadNotifications > 0 && (
            <span className="desktop-top-badge" aria-label={`${unreadNotifications} непрочитанных`}>
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default DesktopTopBar;
