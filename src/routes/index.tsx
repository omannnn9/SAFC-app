import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import heroPlayer from "@/assets/hero-player.jpg";
import playerTau from "@/assets/player-tau.jpg";
import newsTraining from "@/assets/news-training.jpg";
import newsStadium from "@/assets/news-stadium.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bafana Supporters Club — Official Home" },
      {
        name: "description",
        content:
          "Official supporters club of the South African national football team. Join the Pulse of the Nation — memberships, fixtures, and exclusive access.",
      },
      { property: "og:title", content: "Bafana Supporters Club — Official Home" },
      {
        property: "og:description",
        content:
          "Join the Pulse of the Nation. Official memberships, fixtures and exclusive access for supporters of the South African national team.",
      },
    ],
  }),
  component: Home,
});

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor((diff / 3600000) % 24);
  const mins = Math.floor((diff / 60000) % 60);
  const secs = Math.floor((diff / 1000) % 60);
  return { days, hrs, mins, secs };
}

type Tier = {
  name: string;
  price: string;
  tag: string;
  perks: string[];
  cta: string;
  featured?: boolean;
  vip?: boolean;
};

const tiers: Tier[] = [
  {
    name: "Bronze",
    price: "R149",
    tag: "Digital Entry",
    perks: ["Digital membership card", "Newsletter access"],
    cta: "Select Plan",
  },
  {
    name: "Silver",
    price: "R299",
    tag: "Exclusive Access",
    perks: ["All Bronze benefits", "Exclusive content & interviews"],
    cta: "Select Plan",
  },
  {
    name: "Gold",
    price: "R499",
    tag: "Elite Status",
    perks: ["20% Merchandise discount", "Priority ticket access", "Signed digital poster"],
    cta: "Select Plan",
    featured: true,
  },
  {
    name: "VIP Apex",
    price: "R1,200",
    tag: "Full Access",
    perks: ["Hospitality invites", "Annual member jersey", "VIP experiences"],
    cta: "Unlock Now",
    vip: true,
  },
];

const newsItems = [
  {
    tag: "Team News",
    title: "Squad announced for the upcoming continental qualifiers",
    time: "2 Hours Ago",
    img: newsTraining,
  },
  {
    tag: "Stadium",
    title: "FNB Stadium prepped for the record-breaking clash",
    time: "1 Day Ago",
    img: newsStadium,
  },
] as const;

function Home() {
  const matchDate = new Date(Date.now() + (4 * 86400 + 12 * 3600 + 45 * 60) * 1000);
  const { days, hrs, mins } = useCountdown(matchDate);
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {/* National pride bar */}
      <div className="fixed top-0 left-0 w-full h-1 z-50 flex">
        <div className="h-full flex-1 bg-sa-green" />
        <div className="h-full flex-1 bg-sa-gold" />
        <div className="h-full flex-1 bg-sa-red" />
        <div className="h-full flex-1 bg-white" />
        <div className="h-full flex-1 bg-black" />
      </div>

      {/* Header */}
      <header className="sticky top-1 z-40 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="size-8 bg-sa-gold rounded-full flex items-center justify-center">
            <div className="size-4 bg-black rounded-sm rotate-45" />
          </div>
          <span className="font-display font-extrabold uppercase tracking-tighter text-xl">
            Bafana
          </span>
        </div>
        <button className="bg-sa-gold text-black font-display font-extrabold px-4 py-1.5 rounded-full text-xs uppercase tracking-wider active:scale-95 transition-transform">
          Join Club
        </button>
      </header>

      <main className="pb-28">
        {/* Hero */}
        <section
          className="relative px-4 pt-6 pb-10"
          style={{ animation: "reveal-up 0.8s var(--ease-out-expo) both" }}
        >
          <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden mb-6">
            <img
              src={heroPlayer}
              alt="South African national football player walking into the stadium tunnel"
              width={1088}
              height={1344}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute top-4 left-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/70 bg-black/40 backdrop-blur px-2 py-1 rounded">
                The Pulse of the Nation
              </span>
            </div>
            <div className="absolute bottom-0 left-0 w-full p-6">
              <h1 className="font-display font-extrabold italic uppercase text-[2.75rem] leading-[0.85] tracking-tighter mb-4 text-balance">
                More than a <span className="text-sa-gold">Supporter.</span>
                <br />A Shareholder.
              </h1>
              <p className="text-sm text-neutral-300 max-w-[28ch] mb-6 leading-relaxed">
                Official digital access to the heartbeat of South African football.
              </p>
              <button className="w-full bg-white text-black py-4 rounded-xl font-display font-extrabold uppercase text-sm tracking-widest active:scale-[0.98] transition-transform">
                Become a Member
              </button>
            </div>
          </div>

          {/* Countdown */}
          <div className="bg-surface border border-border rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-mono text-[10px] text-sa-green uppercase tracking-widest">
                Next Fixture
              </p>
              <p className="font-display font-bold uppercase">RSA vs NGA</p>
              <p className="font-mono text-[9px] text-muted-foreground uppercase">
                FNB Stadium · 19:30
              </p>
            </div>
            <div className="flex gap-3 items-baseline" aria-label="Countdown to next fixture">
              {[
                { v: pad(days), l: "Days" },
                { v: pad(hrs), l: "Hrs" },
                { v: pad(mins), l: "Min" },
              ].map((s, i, arr) => (
                <div key={s.l} className="flex items-baseline gap-3">
                  <div className="text-center">
                    <span className="block font-display font-extrabold text-2xl tabular-nums">
                      {s.v}
                    </span>
                    <span className="block font-mono text-[9px] text-muted-foreground uppercase">
                      {s.l}
                    </span>
                  </div>
                  {i < arr.length - 1 && <span className="text-muted-foreground">:</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Membership Tiers */}
        <section className="px-4 py-10 bg-surface/40">
          <div className="flex justify-between items-end mb-8">
            <h2 className="font-display font-extrabold italic uppercase text-3xl tracking-tighter">
              The Tiers
            </h2>
            <span className="font-mono text-[10px] text-muted-foreground uppercase pb-1">
              04 Options
            </span>
          </div>

          <div className="space-y-4">
            {tiers.map((tier) => {
              const isVip = !!tier.vip;
              return (
                <div
                  key={tier.name}
                  className={
                    isVip
                      ? "relative p-6 bg-sa-gold rounded-2xl border border-sa-gold overflow-hidden active:scale-[0.98] transition-all shadow-glow-gold"
                      : tier.featured
                        ? "relative p-6 bg-surface rounded-2xl border border-sa-gold/40 overflow-hidden"
                        : "relative p-6 bg-surface rounded-2xl border border-white/5 overflow-hidden"
                  }
                >
                  {isVip && (
                    <div className="absolute -right-8 -top-8 size-32 bg-black/10 rounded-full blur-2xl" />
                  )}
                  <div className="flex justify-between items-start mb-4 relative">
                    <div>
                      <h3
                        className={`font-display font-extrabold uppercase text-xl ${
                          isVip ? "text-black" : tier.featured ? "text-sa-gold" : "text-foreground"
                        }`}
                      >
                        {tier.name}
                      </h3>
                      <p
                        className={`font-mono text-[10px] uppercase ${
                          isVip ? "text-black/60" : "text-muted-foreground"
                        }`}
                      >
                        {tier.tag}
                      </p>
                    </div>
                    <div className={`text-right ${isVip ? "text-black" : ""}`}>
                      <p className="font-display font-extrabold text-xl">{tier.price}</p>
                      <p
                        className={`font-mono text-[9px] uppercase ${
                          isVip ? "text-black/60" : "text-muted-foreground"
                        }`}
                      >
                        Per Year
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6 relative">
                    {tier.perks.map((p) => (
                      <li
                        key={p}
                        className={`flex items-center gap-2 text-xs ${
                          isVip ? "text-black/80" : "text-neutral-400"
                        }`}
                      >
                        <div
                          className={`size-1.5 rounded-full ${
                            isVip ? "bg-black" : "bg-sa-green"
                          }`}
                        />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={`w-full py-3 rounded-lg text-center font-display font-bold uppercase text-[10px] tracking-widest transition-colors ${
                      isVip
                        ? "bg-black text-white"
                        : "bg-white/5 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {tier.cta}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Featured Player */}
        <section className="px-4 py-12">
          <span className="font-mono text-[10px] uppercase tracking-widest text-sa-gold mb-4 block">
            Warrior Profile
          </span>
          <div className="bg-surface rounded-3xl overflow-hidden flex flex-col border border-border">
            <div className="relative aspect-[3/4]">
              <img
                src={playerTau}
                alt="Featured player Percy Tau in South Africa kit"
                width={800}
                height={1024}
                loading="lazy"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
              <div className="absolute top-6 left-6">
                <span className="font-display font-extrabold text-6xl text-sa-gold opacity-70 drop-shadow-lg">
                  10
                </span>
              </div>
              <div className="absolute bottom-6 left-6">
                <h4 className="font-display font-extrabold uppercase text-3xl italic tracking-tighter">
                  Percy
                  <br />
                  Tau
                </h4>
                <p className="font-mono text-[10px] text-sa-green uppercase tracking-widest mt-1">
                  Forward / Al Ahly
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 border-t border-border">
              {[
                { l: "Goals", v: "15" },
                { l: "Apps", v: "42" },
                { l: "Assists", v: "11" },
              ].map((s, i) => (
                <div
                  key={s.l}
                  className={`p-4 text-center ${i < 2 ? "border-r border-border" : ""}`}
                >
                  <span className="block font-mono text-[10px] text-muted-foreground uppercase mb-1">
                    {s.l}
                  </span>
                  <span className="font-display font-extrabold text-xl">{s.v}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* News */}
        <section className="px-4 py-8">
          <div className="flex justify-between items-end mb-8">
            <h2 className="font-display font-extrabold italic uppercase text-3xl tracking-tighter">
              The Journal
            </h2>
            <button className="font-mono text-[10px] text-sa-gold uppercase tracking-widest">
              View All
            </button>
          </div>
          <div className="space-y-6">
            {newsItems.map((n) => (
              <article key={n.title} className="flex gap-4">
                <div className="size-24 shrink-0 rounded-xl overflow-hidden">
                  <img
                    src={n.img}
                    alt=""
                    width={512}
                    height={512}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="font-mono text-[9px] text-sa-gold uppercase tracking-widest mb-1">
                    {n.tag}
                  </span>
                  <h3 className="font-display font-bold text-sm leading-snug mb-2">{n.title}</h3>
                  <span className="text-[10px] text-muted-foreground">{n.time}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full bg-black/95 border-t border-border px-8 pt-3 pb-6 flex justify-between items-center backdrop-blur-xl z-40">
        {[
          { l: "Home", active: true, shape: "dot" },
          { l: "Match", shape: "square" },
          { l: "Club", shape: "circle" },
          { l: "Shop", shape: "diamond" },
        ].map((item) => (
          <button
            key={item.l}
            className={`flex flex-col items-center gap-1.5 ${
              item.active ? "opacity-100" : "opacity-40"
            }`}
          >
            {item.shape === "dot" && <div className="size-1.5 bg-sa-gold rounded-full" />}
            {item.shape === "square" && <div className="size-4 border-2 border-white rounded-sm" />}
            {item.shape === "circle" && <div className="size-4 border-2 border-white rounded-full" />}
            {item.shape === "diamond" && (
              <div className="size-4 border-2 border-white rounded-sm rotate-45" />
            )}
            <span
              className={`font-mono text-[10px] uppercase ${
                item.active ? "text-sa-gold" : ""
              }`}
            >
              {item.l}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
