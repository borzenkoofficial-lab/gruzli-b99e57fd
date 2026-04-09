import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Set app height once — do NOT react to keyboard open/close
const setAppHeight = () => {
  // Use window.innerHeight which stays stable when keyboard opens on iOS/Android
  document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
};

// Restore theme from localStorage
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "light") {
  document.documentElement.classList.add("light");
}

setAppHeight();
// Only update on orientation change, not on keyboard resize
window.addEventListener("orientationchange", () => {
  setTimeout(setAppHeight, 150);
}, { passive: true });

createRoot(document.getElementById("root")!).render(<App />);
