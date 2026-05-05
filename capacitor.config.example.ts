import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.wattscalm.app",
  appName: "Quiet Current",
  webDir: "dist",
  server: {
    // Keep this false for production wrapper builds.
    cleartext: false,
  },
};

export default config;

