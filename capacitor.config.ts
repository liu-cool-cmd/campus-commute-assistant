import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.campuscommute.app',
  appName: 'Campus Commute Assistant',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    CapacitorHttp: { enabled: true },
  },
};

export default config;
