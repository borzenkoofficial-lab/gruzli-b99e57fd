import { useEffect, useState } from "react";
import { BriefcaseBusiness, Command, FolderOpen, LayoutDashboard, MessageCircle, Users, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import "./gruzli-os.css";

type Props = { onClose: () => void };

export default function GruzliOS({ onClose }: Props) {
  const { role } = useAuth();

  const apps =
    role === "client"
      ? [
          { key: "feed", label: "Новый заказ", icon: BriefcaseBusiness, target: "feed" },
          { key: "orders", label: "Заявки", icon: LayoutDashboard, target: "orders" },
          { key: "chats", label: "Чаты", icon: MessageCircle, target: "chats" },
          { key: "profile", label: "Профиль", icon: Users, target: "profile" },
        ]
      : role === "dispatcher"
        ? [
            { key: "feed", label: "Работа", icon: BriefcaseBusiness, target: "feed" },
            { key: "chats", label: "Чаты", icon: MessageCircle, target: "chats" },
            { key: "kartoteka", label: "Картотека", icon: FolderOpen, target: "kartoteka" },
            { key: "profile", label: "Профиль", icon: LayoutDashboard, target: "profile" },
          ]
        : [
            { key: "feed", label: "Лента", icon: BriefcaseBusiness, target: "feed" },
            { key: "orders", label: "Заказы", icon: LayoutDashboard, target: "orders" },
            { key: "chats", label: "Чаты", icon: MessageCircle, target: "chats" },
            { key: "kartoteka", label: "Картотека", icon: FolderOpen, target: "kartoteka" },
            { key: "profile", label: "Профиль", icon: Users, target: "profile" },
          ];

  const [active, setActive] = useState(apps[0]?.key ?? "feed");

  useEffect(() => {
    document.body.classList.add("gruzli-os-open");
    return () => document.body.classList.remove("gruzli-os-open");
  }, []);

  const navigate = (target: string, key: string) => {
    setActive(key);
    window.dispatchEvent(new CustomEvent("gruzli-os-navigate", { detail: { tab: target } }));
    onClose();
  };

  return (
    <div className="gruzli-os" role="dialog" aria-modal="true" aria-label="Gruzli OS">
      <div className="gruzli-os-backdrop" onClick={onClose} />
      <section className="gruzli-os-panel">
        <header className="gruzli-os-topbar">
          <div className="gruzli-os-brand">
            <span className="gruzli-os-dot" />
            <strong>GRUZLI OS</strong>
            <span>WORKSPACE</span>
          </div>
          <button className="gruzli-os-close" type="button" onClick={onClose} aria-label="Закрыть Gruzli OS">
            <X size={18} />
          </button>
        </header>

        <main className="gruzli-os-content">
          <div className="gruzli-os-heading">
            <span>YOUR WORKSPACE</span>
            <h1>Всё рабочее пространство Gruzli — в одном слое.</h1>
            <p>Быстрый переход между основными разделами без изменения существующей бизнес-логики.</p>
          </div>

          <div className="gruzli-os-grid">
            {apps.map(({ key, label, icon: Icon, target }) => (
              <button
                key={key}
                type="button"
                className={active === key ? "gruzli-os-app active" : "gruzli-os-app"}
                onClick={() => navigate(target, key)}
              >
                <span className="gruzli-os-icon"><Icon size={20} /></span>
                <span className="gruzli-os-app-copy">
                  <b>{label}</b>
                  <small>OPEN SPACE</small>
                </span>
              </button>
            ))}
          </div>

          <div className="gruzli-os-signal">
            <Command size={16} />
            <span>Gruzli OS — второй слой интерфейса. Основное приложение остаётся на месте.</span>
          </div>
        </main>

        <footer className="gruzli-os-dock">
          {apps.map(({ key, label, icon: Icon, target }) => (
            <button key={key} type="button" className={active === key ? "active" : ""} onClick={() => navigate(target, key)}>
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
          <button type="button" onClick={onClose}>
            <X size={17} />
            <span>Закрыть</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
