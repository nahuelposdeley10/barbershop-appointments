"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function GalleryLightbox({ images }: { images: string[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedIndex(null);
      if (event.key === "ArrowLeft") {
        setSelectedIndex((current) => current === null ? null : (current - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight") {
        setSelectedIndex((current) => current === null ? null : (current + 1) % images.length);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [images.length, selectedIndex]);

  if (images.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3">
        {images.map((src, index) => (
          <button
            key={`${src}-${index}`}
            type="button"
            onClick={() => setSelectedIndex(index)}
            aria-label={`Ver trabajo ${index + 1} en grande`}
            className="group relative aspect-square overflow-hidden rounded-xl bg-zinc-900 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Image
              src={src}
              alt={`Trabajo ${index + 1}`}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-zinc-950/70 text-accent opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            </span>
          </button>
        ))}
      </div>

      {selectedIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/95 p-3 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Galería, imagen ${selectedIndex + 1} de ${images.length}`}
          onClick={() => setSelectedIndex(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedIndex(null)}
            aria-label="Cerrar imagen ampliada"
            className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-zinc-900/80 text-2xl text-white transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ×
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedIndex((current) => current === null ? null : (current - 1 + images.length) % images.length);
            }}
            aria-label="Ver imagen anterior"
            className="absolute left-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-zinc-900/80 text-2xl text-white transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:left-8"
          >
            ‹
          </button>

          <div className="relative h-[min(78vh,760px)] w-[min(88vw,1100px)]" onClick={(event) => event.stopPropagation()}>
            <Image
              src={images[selectedIndex]}
              alt={`Trabajo ${selectedIndex + 1}`}
              fill
              sizes="(max-width: 768px) 88vw, 1100px"
              className="object-contain"
              priority
            />
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedIndex((current) => current === null ? null : (current + 1) % images.length);
            }}
            aria-label="Ver imagen siguiente"
            className="absolute right-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-zinc-900/80 text-2xl text-white transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:right-8"
          >
            ›
          </button>

          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 backdrop-blur-sm">
            {selectedIndex + 1} / {images.length}
          </p>
        </div>
      )}
    </>
  );
}
