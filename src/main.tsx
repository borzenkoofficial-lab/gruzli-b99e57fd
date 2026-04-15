import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Restore theme from localStorage
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "light") {
  document.documentElement.classList.add("light");
} else if (savedTheme && savedTheme !== "dark") {
  document.documentElement.classList.add(savedTheme);
}

createRoot(document.getElementById("root")!).render(<App />);
