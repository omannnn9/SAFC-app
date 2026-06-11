import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachFreshSupabaseAuth } from "@/lib/fresh-auth-attacher";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const env = typeof process !== "undefined" ? process.env : undefined;
if (env) {
  env.SUPABASE_URL ||= env.VITE_SUPABASE_URL;
  env.SUPABASE_PUBLISHABLE_KEY ||=
    env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  env.VITE_SUPABASE_URL ||= env.SUPABASE_URL;
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||= env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  env.SUPABASE_PROJECT_ID ||= env.VITE_SUPABASE_PROJECT_ID;
}

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const watchPartySubdomainMiddleware = createMiddleware({ type: "request" }).server(async ({ request, pathname, next }) => {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const sub = host.split(":")[0].split(".")[0];
  if (pathname === "/" && ["welcomect", "welcomejozi", "welcomeuk"].includes(sub)) {
    return Response.redirect(new URL("/watchparties/welcome.html", request.url), 302);
  }
  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [watchPartySubdomainMiddleware, errorMiddleware],
  functionMiddleware: [attachSupabaseAuth, attachFreshSupabaseAuth],
}));
