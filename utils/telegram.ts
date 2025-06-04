import { webApp } from './telegram-sdk';

// Define ColorType based on linter error message
type ColorType = "bg_color" | "secondary_bg_color" | `#${string}`;

const initialize = async (): Promise<void> => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Verify we have user data
    if (!webApp.initDataUnsafe?.user) {
      throw new Error('Could not retrieve Telegram user data. Please open in Telegram.');
    }

    // Ensure the WebApp is ready
    if (typeof webApp.ready === 'function') {
      webApp.ready();
    }
  } catch (e) {
    console.error('Error initializing WebApp:', e);
    throw e;
  }
};

const getUser = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const user = webApp.initDataUnsafe?.user;
    if (!user) {
      throw new Error('Could not retrieve Telegram user data. Please open in Telegram.');
    }
    return user;
  } catch (e) {
    console.warn('Error getting user data:', e);
    return null;
  }
};

const setHeaderColor = (color: ColorType) => {
  if (typeof window === 'undefined') return;
  try {
    // Use the explicitly defined ColorType
    webApp.setHeaderColor(color);
  } catch (e) {
    console.warn('Error setting header color:', e);
  }
};

const setBackgroundColor = (color: ColorType) => {
  if (typeof window === 'undefined') return;
  try {
    // Use the explicitly defined ColorType
    webApp.setBackgroundColor(color);
  } catch (e) {
    console.warn('Error setting background color:', e);
  }
};

const isReady = () => {
  if (typeof window === 'undefined') return false;
  try {
    return typeof webApp.ready === 'function' && webApp.ready();
  } catch (e) {
    console.warn('Error checking if WebApp is ready:', e);
    return false;
  }
};

const showConfirm = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if (!webApp || typeof webApp.showConfirm !== 'function') {
      console.warn('showConfirm method not available on WebApp');
      resolve(false);
      return;
    }

    try {
      webApp.showConfirm(message, (ok: boolean) => resolve(ok));
    } catch (e) {
      console.warn('Error showing confirm dialog:', e);
      resolve(false);
    }
  });
};

const showPopup = (params: any): Promise<string | null> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }

    if (!webApp || typeof webApp.showPopup !== 'function') {
      console.warn('showPopup method not available on WebApp');
      resolve(null);
      return;
    }

    try {
      // Adjust callback signature to match SDK's expected type (id?: string | undefined) => unknown
      webApp.showPopup(params, (buttonId?: string) => {
        resolve(buttonId === undefined ? null : buttonId);
      });
    } catch (e) {
      console.warn('Error showing popup:', e);
      resolve(null);
    }
  });
};

const showScanQrPopup = (params: { text?: string }): Promise<string | null> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }

    if (!webApp || typeof webApp.showScanQrPopup !== 'function') {
      console.warn('showScanQrPopup method not available on WebApp');
      resolve(null);
      return;
    }

    try {
      webApp.showScanQrPopup(params, (text: string | null) => resolve(text));
    } catch (e) {
      console.warn('Error showing QR scanner:', e);
      resolve(null);
    }
  });
};

export const telegramUtils = {
  initialize,
  getUser,
  setHeaderColor,
  setBackgroundColor,
  isReady,
  showConfirm,
  showPopup,
  showScanQrPopup,
};

export { getUser, initialize };
