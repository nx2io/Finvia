import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.finvia.com',
  appName: 'Finvia',
  webDir: 'www',
  server: {
    androidScheme: 'http', // دعم البروتوكول https://
    iosScheme: 'http',    // دعم البروتوكول aray://
    cleartext: true, // ⚡ حل مشاكل `WebView` عند استدعاء API داخلي
    allowNavigation: []
  },
  plugins:{
    CapacitorWebView: {
      allowNavigation: []
    },
    SplashScreen: {
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: "#006fff",
      androidSplashResourceName: "splash",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: "launch_screen",
      useDialog: true,
    },
    StatusBar: {
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#131417",
    },
  }
};

export default config;
