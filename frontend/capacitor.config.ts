import type { CapacitorConfig } from '@capacitor/cli';

// Provisional package namespace: confirm ownership in App publishing before signing/uploading.
const config: CapacitorConfig = {
  appId: process.env.ANDROID_APP_ID || 'in.evolixstudio.retail',
  appName: 'Apna Galla',
  webDir: 'dist',
  android: { allowMixedContent: false },
  server: { androidScheme: 'https' },
};
export default config;
