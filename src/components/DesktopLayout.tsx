import { ReactNode } from "react";
import { X } from "lucide-react";

interface DesktopLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
  detail?: ReactNode;
  topBar?: ReactNode;
  onCloseDetail?: () => void;
  detailTitle?: string;
}

const DesktopLayout = ({
  sidebar,
  main,
  detail,
  topBar,
  onCloseDetail,
  detailTitle,
}: DesktopLayoutProps) => {
  return (
    <div className="desktop-shell">
      {sidebar}
      <div className="desktop-content">
        {topBar && <header className="desktop-topbar">{topBar}</header>}
        <main className="desktop-main">
          <div className="desktop-main-inner">{main}</div>
        </main>
      </div>
      {detail && (
        <aside className="desktop-detail">
          {(onCloseDetail || detailTitle) && (
            <div className="desktop-detail-header">
              <span className="text-sm font-semibold text-foreground truncate">
                {detailTitle || "Подробности"}
              </span>
              {onCloseDetail && (
                <button
                  onClick={onCloseDetail}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
                  aria-label="Закрыть"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          )}
          <div className="desktop-detail-body">
            <div className="gruzli-preview-frame">
              <div className="gruzli-preview-chrome">
                <span className="gruzli-window-dot" /><span className="gruzli-window-dot" /><span className="gruzli-window-dot" />
                <span className="gruzli-preview-address">gruzli.app</span>
              </div>
              <div className="gruzli-preview-content">{detail}</div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};

export default DesktopLayout;
