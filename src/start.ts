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
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||=
    env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
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

const securityHeadersMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) => {
  const response = (await next()) as unknown as Response;
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  if (!headers.has("Content-Security-Policy")) {
    headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https://*.supabase.co https://auth.southafricafc.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "connect-src 'self' https://*.supabase.co https://auth.southafricafc.com https://api.stripe.com https://accounts.google.com",
        "frame-src 'self' https://accounts.google.com https://checkout.stripe.com https://js.stripe.com",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    );
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

const watchPartySubdomainMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, pathname, next }) => {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
    const sub = host.split(":")[0].split(".")[0];
    if (pathname === "/" && ["welcomect", "welcomejozi", "welcomeuk"].includes(sub)) {
      return Response.redirect(new URL("/watchparties/welcome.html", request.url), 302);
    }
    return next();
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware, watchPartySubdomainMiddleware, errorMiddleware],
  functionMiddleware: [attachSupabaseAuth, attachFreshSupabaseAuth],
}));
