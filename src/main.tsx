import { createRoot } from "react-dom/client";
import "./index.css";
import "./gruzli-editorial.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Gruzli: root element "#root" was not found.');
}

const root = createRoot(rootElement);

// Load the application after the React root exists. A module-evaluation error
// (for example, a missing production environment variable) must not leave a
// completely blank page before ErrorBoundary can mount.
void import("./App.tsx")
  .then(({ default: App }) => {
    root.render(<App />);
  })
  .catch((error: unknown) => {
    console.error("[Gruzli Startup] Application failed to load:", error);

    const message = error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);

    root.render(
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f5f5f5",
          color: "#171717",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <section style={{ width: "100%", maxWidth: "480px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 800 }}>Gruzli не удалось запустить</h1>
          <p style={{ marginTop: "12px", lineHeight: 1.5 }}>
            Приложение обнаружило ошибку при начальной загрузке. Обновите страницу.
            Если ошибка повторится, отправьте техническую информацию в поддержку.
          </p>
          <pre
            style={{
              marginTop: "20px",
              padding: "14px",
              overflowWrap: "anywhere",
              whiteSpace: "pre-wrap",
              borderRadius: "12px",
              background: "#e8e8e8",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            {message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: "18px",
              padding: "12px 18px",
              border: 0,
              borderRadius: "12px",
              background: "#f2c400",
              color: "#111",
              fontWeight: 700,
            }}
          >
            Обновить страницу
          </button>
        </section>
      </main>,
    );
  });
