"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";
import { META_PIXEL_ID, metaPixelAllowed } from "@/lib/meta-pixel";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
};

declare global {
  interface Window { fbq?: Fbq; _fbq?: Fbq }
}

/** Meta's standard loader, once per page load. Returns the fbq queue, usable before fbevents.js arrives. */
function loadPixel(id: string): Fbq {
  if (window.fbq) return window.fbq;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  // We send PageView ourselves, only on public pages. Without this the pixel follows every client-side navigation,
  // into the dashboard too.
  fbq.disablePushState = true;
  window.fbq = fbq;
  window._fbq ??= fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  // No automatic events: they read button text and page metadata
  fbq("set", "autoConfig", false, id);
  fbq("init", id);
  return fbq;
}

function Tracker({ id }: { id: string }) {
  const pathname = usePathname();
  useEffect(() => {
    if (!metaPixelAllowed(pathname)) return;
    const fbq = loadPixel(id);
    fbq("consent", "grant");
    fbq("track", "PageView");
    // The script stays loaded after a client-side navigation into sign-in or the dashboard, so stop it sending
    return () => fbq("consent", "revoke");
  }, [id, pathname]);
  return null;
}

/** For the public layouts only (see lib/meta-pixel). Renders nothing unless NEXT_PUBLIC_META_PIXEL_ID is set. */
export function MetaPixel() {
  if (!META_PIXEL_ID) return null;
  // usePathname suspends while prerendering pages with unknown params; the tracker has nothing to show anyway
  return <Suspense fallback={null}><Tracker id={META_PIXEL_ID} /></Suspense>;
}
