import { useEffect, useState } from "react";

import photo1 from "@/assets/carousel/photo1.jpg";
import photo2 from "@/assets/carousel/photo2.jpg";
import photo3 from "@/assets/carousel/photo3.jpg";
import photo4 from "@/assets/carousel/photo4.jpg";
import photo5 from "@/assets/carousel/photo5.jpg";

const SLIDES = [
  photo1,
  photo2,
  photo3,
  photo4,
  photo5,
];

export function HeroCarousel({
  intervalMs = 4500,
}: {
  intervalMs?: number;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIdx((current) => (current + 1) % SLIDES.length);
    }, intervalMs);

    return () => clearInterval(timer);
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

      {/* Readability overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/65 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}
