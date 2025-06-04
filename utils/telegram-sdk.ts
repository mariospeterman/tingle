import WebApp from '@twa-dev/sdk';

// Declare the Telegram WebApp type on the window object
declare global {
  interface Window {
    Telegram?: {
      WebApp: typeof WebApp;
    };
  }
}

// Mock WebApp for development
const mockWebApp = {
  initData: 'mock_init_data',
  initDataUnsafe: {
    query_id: 'mock_query_id',
    user: {
      id: 123456789,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      language_code: 'en',
    },
    auth_date: Date.now(),
    hash: 'mock_hash',
  },
  version: '6.0',
  platform: 'web',
  colorScheme: 'light',
  themeParams: {
    bg_color: '#ffffff',
    text_color: '#000000',
    hint_color: '#999999',
    link_color: '#2481cc',
    button_color: '#2481cc',
    button_text_color: '#ffffff',
  },
  isExpanded: true,
  viewportHeight: 600,
  viewportStableHeight: 600,
  headerColor: '#ffffff',
  backgroundColor: '#ffffff',
  isClosingConfirmationEnabled: false,
  onEvent: (eventType: string, eventHandler: Function) => {},
  offEvent: (eventType: string, eventHandler: Function) => {},
  sendData: (data: any) => {},
  openLink: (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  },
  openTelegramLink: (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  },
  openInvoice: (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  },
  showPopup: (params: any) => Promise.resolve(),
  showAlert: (message: string) => Promise.resolve(),
  showConfirm: (message: string) => Promise.resolve(true),
  ready: () => {},
  expand: () => {},
  close: () => {},
  enableClosingConfirmation: () => {},
  disableClosingConfirmation: () => {},
  setHeaderColor: (color: string) => {},
  setBackgroundColor: (color: string) => {},
  MainButton: {
    text: '',
    color: '',
    textColor: '',
    isVisible: false,
    isActive: false,
    isProgressVisible: false,
    setText: (text: string) => {},
    onClick: (callback: Function) => {},
    offClick: (callback: Function) => {},
    show: () => {},
    hide: () => {},
    enable: () => {},
    disable: () => {},
    showProgress: (leaveActive: boolean) => {},
    hideProgress: () => {},
  },
  BackButton: {
    isVisible: false,
    onClick: (callback: Function) => {},
    offClick: (callback: Function) => {},
    show: () => {},
    hide: () => {},
  },
  HapticFeedback: {
    impactOccurred: (style: string) => {},
    notificationOccurred: (type: string) => {},
    selectionChanged: () => {},
  },
};

// Initialize WebApp
let webApp: typeof WebApp;

// Only initialize WebApp on the client side
if (typeof window !== 'undefined') {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Running in development mode with mock Telegram WebApp');
      webApp = mockWebApp as any;
    } else {
      // Safely initialize WebApp only if window.Telegram exists
      if (window.Telegram?.WebApp) {
        webApp = window.Telegram.WebApp;
        webApp.ready();
      } else {
        console.warn('Telegram WebApp not found, using mock');
        webApp = mockWebApp as any;
      }
    }
  } catch (error) {
    console.error('Error initializing Telegram WebApp:', error);
    if (process.env.NODE_ENV === 'development') {
      console.warn('Falling back to mock WebApp in development mode');
      webApp = mockWebApp as any;
    } else {
      throw error;
    }
  }
} else {
  // During SSR, use mock WebApp
  webApp = mockWebApp as any;
}

export { webApp }; 