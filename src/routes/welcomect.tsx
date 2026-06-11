import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/welcomect")({
  beforeLoad: () => {
    throw redirect({ href: "/watchparties/welcome.html" });
  },
});
