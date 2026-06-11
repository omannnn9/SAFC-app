import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, watchPartyConfig } from "@/lib/watchparty";

export const Route = createFileRoute("/api/watchparty/config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        return jsonResponse(watchPartyConfig(url.searchParams.get("source")));
      },
    },
  },
});
