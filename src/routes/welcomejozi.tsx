import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/welcomejozi")({
  beforeLoad: () => {
    throw redirect({ href: "/watchparties/welcome.html" });
  },
});
