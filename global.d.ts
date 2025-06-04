// global.d.ts
export {};

declare global {
  interface Window {
    Telegram: any; // Replace 'any' with the appropriate type if available
  }
}
