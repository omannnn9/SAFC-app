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

// Standard TanStack Start + Vercel config.
// - tanstackStart: file-based routing, SSR, server functions
// - nitro preset "vercel": emits .vercel/output for Vercel serverless deploy
// - default start entry: src/start.ts
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
      preset: process.env.NITRO_PRESET ?? "vercel",
    }),
    viteReact(),
  ],
});
