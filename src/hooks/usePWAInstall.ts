import { useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type DesktopOS = "windows" | "mac" | "linux" | "android" | "ios" | "unknown";

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [os, setOS] = useState<DesktopOS>("unknown");

  useEffect(() => {
    // 1. Detect standalone display mode (already installed as desktop app or PWA)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes("android-app://");
    setIsInstalled(isStandalone);

    // 2. Detect Operating System
    const userAgent = window.navigator.userAgent.toLowerCase();
    const platform = (window.navigator as any).userAgentData?.platform?.toLowerCase() || window.navigator.platform.toLowerCase();

    if (/win/.test(platform) || /windows/.test(userAgent)) {
      setOS("windows");
    } else if (/mac/.test(platform) || /macintosh/.test(userAgent)) {
      setOS("mac");
    } else if (/linux/.test(platform) || /linux/.test(userAgent)) {
      setOS("linux");
    } else if (/iphone|ipad|ipod/.test(userAgent)) {
      setOS("ios");
    } else if (/android/.test(userAgent)) {
      setOS("android");
    }

    // 3. Listen for browser beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.warn("[PWA] Installation prompt error:", err);
      return false;
    }
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    os,
    install,
    hasPrompt: !!deferredPrompt,
  };
}
