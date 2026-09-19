import { registerSW } from 'virtual:pwa-register';

export function registerPWA() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    registerSW({
      immediate: true,
      onRegistered(r) {
        console.log('[PWA] Service Worker successfully registered:', r?.scope);
      },
      onRegisterError(error) {
        console.warn('[PWA] Service Worker registration failed:', error);
      },
    });
  }
}
