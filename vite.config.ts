import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

process.env.SUPABASE_PUBLISHABLE_KEY ||= process.env.SUPABASE_ANON_KEY;
process.env.VITE_SUPABASE_URL ||= process.env.SUPABASE_URL;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||=
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
process.env.VITE_SUPABASE_PROJECT_ID ||= process.env.SUPABASE_PROJECT_ID;

// TanStack Start config for the GCP Cloud Run deployment.
// - tanstackStart: file-based routing, SSR, server functions
// - nitro preset "node-server": emits a Node server (.output/server/index.mjs)
//   that Cloud Run runs and that honors the injected PORT. The Dockerfile sets
//   NITRO_PRESET=node-server explicitly; this default keeps local builds aligned.
export default defineConfig({
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
      preset: process.env.NITRO_PRESET ?? "node-server",
    }),
    viteReact(),
  ],
});
