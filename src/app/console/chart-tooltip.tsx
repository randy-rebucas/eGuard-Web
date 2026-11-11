"use client";

import { useEffect, useRef } from "react";
import type { Tip } from "./charts";

/**
 * One tooltip for every chart on the page. Marks carry `data-tip` (JSON: a title and rows of label, value, color);
 * hovering or focusing one shows it beside the mark. Built with textContent: names come from data, never as HTML.
 */
export function ChartTooltip() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let current: HTMLElement | null = null;

    const render = (t: Tip) => {
      el.replaceChildren();
      for (const [label, value, color] of t.r) {
        const row = document.createElement("div");
        row.className = "cn-tip-row";
        const key = document.createElement("span");
        key.className = "cn-key-line";
        if (color) key.style.background = color;
        const v = document.createElement("b");
        v.textContent = value;
        const l = document.createElement("span");
        l.textContent = label;
        row.append(key, v, l);
        el.append(row);
      }
      const title = document.createElement("div");
      title.className = "cn-tip-title";
      title.textContent = t.t;
      el.prepend(title);
    };

    const place = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 14));
      const top = y - r.height - 12 < 8 ? y + 18 : y - r.height - 12;
      el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    };

    const show = (target: HTMLElement, x: number, y: number) => {
      if (target !== current) {
        let t: Tip;
        try { t = JSON.parse(target.dataset.tip ?? ""); } catch { return; }
        current = target;
        render(t);
        el.hidden = false;
      }
      place(x, y);
    };
    const hide = () => { current = null; el.hidden = true; };
    const markOf = (e: Event) => (e.target instanceof Element ? (e.target.closest("[data-tip]") as HTMLElement | null) : null);

    const onMove = (e: PointerEvent) => {
      const m = markOf(e);
      if (m) show(m, e.clientX, e.clientY);
      else if (current) hide();
    };
    const onFocus = (e: FocusEvent) => {
      const m = markOf(e);
      if (!m) return;
      const r = m.getBoundingClientRect();
      show(m, r.left + r.width / 2, r.top);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") hide(); };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    document.addEventListener("scroll", hide, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("scroll", hide, true);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return <div ref={box} className="cn-tip" role="tooltip" hidden />;
}
