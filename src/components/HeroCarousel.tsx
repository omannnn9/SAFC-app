import { useEffect, useState } from "react";
import p0 from "@/assets/carousel/photos_0.jpg.asset.json";
import p1 from "@/assets/carousel/photos_1.jpg.asset.json";
import p2 from "@/assets/carousel/photos_2.jpg.asset.json";
import p3 from "@/assets/carousel/photos_3.jpg.asset.json";
import p4 from "@/assets/carousel/photos_4.jpg.asset.json";
import p5 from "@/assets/carousel/photos_5.jpg.asset.json";
import p6 from "@/assets/carousel/photos_6.jpg.asset.json";
import p7 from "@/assets/carousel/photos_7.jpg.asset.json";
import a0 from "@/assets/carousel/posters_0.jpg.asset.json";
import a1 from "@/assets/carousel/posters_1.jpg.asset.json";
import a2 from "@/assets/carousel/posters_2.jpg.asset.json";
import a3 from "@/assets/carousel/posters_3.jpg.asset.json";
import a4 from "@/assets/carousel/posters_4.jpg.asset.json";
import a5 from "@/assets/carousel/posters_5.jpg.asset.json";
import a6 from "@/assets/carousel/posters_6.jpg.asset.json";
import a7 from "@/assets/carousel/posters_7.jpg.asset.json";
import logo from "@/assets/carousel/logo.png.asset.json";
import collage from "@/assets/carousel/collage.png.asset.json";

const SLIDES = [
  p0, p1, p2, p3, p4, p5, p6, p7,
  a0, a1, a2, a3, a4, a5, a6, a7,
  collage, logo,
].map((a) => a.url);

export function HeroCarousel({ intervalMs = 4500 }: { intervalMs?: number }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {SLIDES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out ${
            i === idx ? "opacity-100 slow-zoom" : "opacity-0"
          }`}
        />
      ))}
      {/* Readability overlays — strong bottom gradient + vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/65 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}
