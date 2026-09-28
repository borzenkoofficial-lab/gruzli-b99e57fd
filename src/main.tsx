import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./gruzli-editorial.css";

// Restore theme from localStorage
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("gruzli-dark");
} else if (savedTheme === "light" || !savedTheme) {
  document.documentElement.classList.add("light");
} else {
  document.documentElement.classList.add(savedTheme);
}

createRoot(document.getElementById("root")!).render(<App />);
