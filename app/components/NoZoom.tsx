"use client";

import { useEffect } from "react";

/**
 * Bloquea el zoom por pellizco en navegadores que ignoran
 * user-scalable=no (por ejemplo, Safari en iOS).
 */
export default function NoZoom() {
  useEffect(() => {
    const preventZoom = (event: Event) => event.preventDefault();
    const preventPinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };

    document.addEventListener("gesturestart", preventZoom);
    document.addEventListener("gesturechange", preventZoom);
    document.addEventListener("gestureend", preventZoom);
    document.addEventListener("touchmove", preventPinch, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventZoom);
      document.removeEventListener("gesturechange", preventZoom);
      document.removeEventListener("gestureend", preventZoom);
      document.removeEventListener("touchmove", preventPinch);
    };
  }, []);

  return null;
}
