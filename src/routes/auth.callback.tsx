import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { SafcLogo } from "@/components/SafcLogo";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing in… — SA FC" }] }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const popRedirect = () => {
      let target = "/";
      try {
        target = sessionStorage.getItem("safc_post_login_redirect") || "/";
        sessionStorage.removeItem("safc_post_login_redirect");
      } catch {
        target = "/";
      }
      return target && target.startsWith("/") ? target : "/";
    };

    const run = async () => {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const oauthError = url.searchParams.get("error") || hashParams.get("error");
      const oauthErrorDesc =
        url.searchParams.get("error_description") || hashParams.get("error_description");

      if (oauthError) {
        const msg = (oauthErrorDesc || oauthError).replace(/\+/g, " ");
        setError(msg);
        toast.error(msg || "Google sign-in failed.");
        setTimeout(() => navigate({ to: "/login" }), 2500);
        return;
      }

      // supabase-js (detectSessionInUrl) processes the implicit hash or the
      // PKCE `?code=` automatically on client init. Poll until the session lands.
      for (let i = 0; i < 30; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          toast.success("Signed in with Google.");
          navigate({ to: popRedirect() });
          return;
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      setError("Sign-in timed out. Please try again.");
      toast.error("Google sign-in timed out. Please try again.");
      setTimeout(() => navigate({ to: "/login" }), 2500);
    };

    void run();
  }, [navigate]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <SafcLogo size={56} />
      {error ? (
        <>
          <p className="text-sm font-semibold text-foreground">Sign-in failed</p>
          <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">Redirecting you back to sign in…</p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Completing your sign-in…
          </div>
        </>
      )}
    </div>
  );
}
