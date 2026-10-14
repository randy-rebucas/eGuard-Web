"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { finishIntro } from "@/app/actions/family";

// The intro and the tour only render once per parent (or on a replay), so their code stays out of the page bundle
const loadTour = () => import("./tour-dialogs");
const Intro = dynamic(() => loadTour().then((m) => m.Intro), { ssr: false });
const QuickTour = dynamic(() => loadTour().then((m) => m.QuickTour), { ssr: false });

const REPLAY = "eg:tour";
/** Replays the quick tour from anywhere in the app (the profile menu). */
export const startTour = () => window.dispatchEvent(new Event(REPLAY));

/**
 * First-run intro, then the quick tour: coach marks over the real navigation and dashboard. `intro` is true until the
 * parent closes the intro once; after that the tour only runs when replayed.
 */
export function Tour({ intro, firstName, hasChildren }: { intro: boolean; firstName: string; hasChildren: boolean }) {
  const [mode, setMode] = useState<"intro" | "tour" | null>(intro ? "intro" : null);
  const path = usePathname();
  const router = useRouter();

  const tour = useCallback(() => {
    // The tour points at the dashboard as well as the navigation
    if (path !== "/dashboard") router.push("/dashboard");
    setMode("tour");
  }, [path, router]);

  useEffect(() => {
    window.addEventListener(REPLAY, tour);
    return () => window.removeEventListener(REPLAY, tour);
  }, [tour]);

  // Stable, so the tour's effects don't restart when this re-renders (e.g. on the way to the dashboard)
  const close = useCallback(() => setMode(null), []);

  const closeIntro = (next: "tour" | null) => {
    // Seen either way; if saving fails (offline) the intro just comes back on the next visit
    void finishIntro().catch(() => {});
    if (next === "tour") tour(); else setMode(null);
  };

  if (mode === "intro") return <Intro firstName={firstName} onTour={() => closeIntro("tour")} onSkip={() => closeIntro(null)} />;
  if (mode === "tour") return <QuickTour hasChildren={hasChildren} onClose={close} />;
  return null;
}
