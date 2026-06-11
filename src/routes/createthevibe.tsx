import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/createthevibe")({
  beforeLoad: () => {
    throw redirect({ href: "/watchparties/create-the-vibe.html" });
  },
});
