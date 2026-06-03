import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// TanStack Start config — works for Vercel AND Render.
// - tanstackStart: file-based routing, SSR, server functions (the "backend")
// - nitro preset: set NITRO_PRESET=node-server for Render Web Services,
//   defaults to "vercel" for Vercel deploys.
// - Firecrawl / undici / @mendable are server-only — loaded via dynamic
//   import() inside *.functions.ts / *.server.ts handlers and blocked
//   from the client bundle by tanstackStart importProtection.
// - default start entry: src/start.ts

export default defineConfig({
  build: {
    rollupOptions: {
      external: ["undici"],
    },
  },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    nitro({
      preset: process.env.NITRO_PRESET ?? "vercel",
    }),
    viteReact(),
  ],
});
