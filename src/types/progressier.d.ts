/* Global Progressier SDK type declarations */
interface ProgressierSDK {
  add(params: { email?: string; id?: string; [key: string]: any }): void;
  subscribe(): Promise<void>;
  unsubscribe(): Promise<void>;
}

interface Window {
  progressier?: ProgressierSDK;
}
