import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fameplays.app',
  appName: 'Fame Plays',
  webDir: 'frontend/dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    FirebaseAuthentication: {
      authDomain: 'fameplays-b2cfb.firebaseapp.com',
      providers: ['google.com'],
      skipNativeAuth: false
    }
  }
};

export default config;
