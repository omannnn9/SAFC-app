import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/welcomeuk")({
  beforeLoad: () => {
    throw redirect({ href: "/watchparties/welcome.html" });
  },
});
