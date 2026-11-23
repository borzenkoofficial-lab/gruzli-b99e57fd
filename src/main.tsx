import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./gruzli-editorial.css";

function registerGruzliServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.warn("[Gruzli PWA] Service worker registration failed:", error);
    });
  });
}

registerGruzliServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
