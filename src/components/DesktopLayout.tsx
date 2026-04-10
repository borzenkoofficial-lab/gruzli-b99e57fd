import { ReactNode } from "react";

interface DesktopLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
  detail?: ReactNode;
}

const DesktopLayout = ({ sidebar, main, detail }: DesktopLayoutProps) => {
  return (
    <div className="desktop-shell">
      {sidebar}
      <main className="desktop-main">
        {main}
      </main>
      {detail && (
        <aside className="desktop-detail">
          {detail}
        </aside>
      )}
    </div>
  );
};

export default DesktopLayout;
