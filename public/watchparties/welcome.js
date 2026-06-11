const WATCH_PARTY_KEYS = ["welcomect", "welcomejozi", "welcomeuk"];
const sourceFromHost = () => {
  const h = location.hostname.split(".")[0];
  if (WATCH_PARTY_KEYS.includes(h)) return h;
  const p = location.pathname.replace(/^\//, "").replace(/\/$/, "");
  if (WATCH_PARTY_KEYS.includes(p)) return p;
  return "main";
};
const $ = (id) => document.getElementById(id);
let cfg = null;

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options,
  });
  const type = res.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && data.error) || data || `Request failed ${res.status}`);
  return data;
}

function platformHandle() {
  return cfg.social.instagram_handle || cfg.safc_handle || "@southafricafc";
}

function signupHref() {
  if (cfg.source_key === "welcomect") {
    return "https://welcomect.southafricafc.com/signup?source=welcomect&watchparty=1&location=Cape+Town&venue=Toad+on+the+Road";
  }
  const params = new URLSearchParams({
    source: cfg.source_key,
    watchparty: "1",
    location: cfg.location,
    venue: cfg.venue,
  });
  return `/signup?${params.toString()}`;
}

function shareText() {
  if (cfg.source_key === "welcomect") {
    return "I joined @southafricafc to support Bafana Bafana 🇿🇦 at @thetoad. Mzansi gees only!\nJoin the South Africa Football Community: https://www.southafricafc.com";
  }
  return `I joined ${platformHandle()} to support Bafana Bafana 🇿🇦 at ${cfg.venue} ${cfg.venue_tag}. Mzansi gees only!\nJoin the South Africa Football Community: https://www.southafricafc.com`;
}

async function load() {
  cfg = await api(`/api/watchparty/config?source=${encodeURIComponent(sourceFromHost())}`);
  document.title =
    cfg.source_key === "welcomect" ? "Cape Town Watch Party" : `SA FC ${cfg.location} Watch Party`;
  $("location-title").textContent = cfg.location;
  $("venue-name").textContent = cfg.venue;
  $("venue-copy").textContent =
    cfg.source_key === "welcomect"
      ? "Welcome to our Toad on the Road Watch Party!\n\nGrab a drink, join the community and show your support for Bafana Bafana 🇿🇦 and stand a chance to win some amazing prizes throughout the night!"
      : `${cfg.location} check-in for ${cfg.venue}. Continue through the official South Africa Football Community sign-up flow.`;
  const signup = $("signup-link");
  if (signup) signup.href = signupHref();
  const links = {
    instagram: cfg.social.instagram,
    tiktok: cfg.social.tiktok,
    youtube: cfg.social.youtube,
  };
  Object.entries(links).forEach(([id, url]) => {
    const el = $(id);
    if (el && url) el.href = url;
  });
  const text = shareText();
  $("share-text").textContent = text;
  $("x-share").href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  $("wa-share").href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  $("native-share").onclick = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text, url: signupHref(), title: document.title });
      } else {
        await navigator.clipboard.writeText(text);
        alert("Post text copied.");
      }
    } catch (e) {
      if (e.name !== "AbortError") alert(e.message);
    }
  };
  $("copy-share").onclick = async () => {
    await navigator.clipboard.writeText(text);
    alert("Post text copied.");
  };
}

load().catch((err) => {
  const result = $("signup-result");
  if (result) {
    result.classList.remove("hidden");
    result.textContent = err.message;
  }
});
