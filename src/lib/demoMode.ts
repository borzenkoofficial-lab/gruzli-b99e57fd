const isVercelPreview = import.meta.env.VERCEL_ENV === "preview";

export const DEMO_ENABLED =
  import.meta.env.VITE_GRUZLI_DEMO_MODE === "true" &&
  (import.meta.env.DEV || isVercelPreview);
