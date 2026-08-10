import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.trendpost.app",
  appName: "TrendPosT",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // The server this app talks to is whatever host the user enters on first
    // launch (see src/components/HostGate.tsx) — it's frequently a plain
    // http:// LAN address (e.g. a machine on the same Wi-Fi running `npm run
    // dev`), which Android blocks by default. This app's own outgoing
    // requests are the only thing affected; it does not weaken TLS
    // validation for https:// hosts.
    cleartext: true,
  },
};

export default config;
