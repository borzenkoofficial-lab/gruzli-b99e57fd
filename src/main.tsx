import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const syncAppViewport = () => {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${height}px`);
};

// Restore theme from localStorage
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "light") {
  document.documentElement.classList.add("light");
}

syncAppViewport();
window.addEventListener("resize", syncAppViewport, { passive: true });
window.addEventListener("orientationchange", syncAppViewport, { passive: true });
window.visualViewport?.addEventListener("resize", syncAppViewport);
window.visualViewport?.addEventListener("scroll", syncAppViewport);

createRoot(document.getElementById("root")!).render(<App />);
