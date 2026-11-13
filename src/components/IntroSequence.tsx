"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ELF_INTRO_DURATION } from "@/lib/elf";
import "./intro-sequence.css";

const signatureBytes = [
  { hex: "65", letter: "e" },
  { hex: "74", letter: "t" },
  { hex: "6f", letter: "o" },
];

export default function IntroSequence() {
  const [playing, setPlaying] = useState(false);
  const finishRef = useRef<() => void>(() => {});
  const timerRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!playing) return;
    const root = document.getElementById("portfolio");
    if (!root) return;
    root.dataset.introStarted = String(performance.now());
    root.dataset.introState = "playing";
    root.style.setProperty("--intro-progress", "0");
    root.style.setProperty("--intro-content-reveal", "0");
    timerRef.current = window.setTimeout(() => finishRef.current(), ELF_INTRO_DURATION);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [playing]);

  useEffect(() => {
    const root = document.getElementById("portfolio");
    if (!root) return;
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const aboutEntry = ["", "#about", "#top", "#main"].includes(location.hash);
    const savedPosition = Number(new URLSearchParams(location.search).get("p")) > 0;
    const eligible = aboutEntry && !savedPosition && scrollY <= 32 && !motionQuery.matches
      && !document.hidden && navigation?.type !== "back_forward";
    if (!eligible) {
      root.dataset.introState = "complete";
      root.style.setProperty("--intro-progress", "1");
      root.style.setProperty("--intro-content-reveal", "1");
      return;
    }

    let completed = false;
    let disposed = false;

    function finish() {
      if (completed) return;
      completed = true;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      root!.dataset.introState = "complete";
      root!.style.setProperty("--intro-progress", "1");
      root!.style.setProperty("--intro-content-reveal", "1");
      removeEventListener("wheel", finish, true);
      removeEventListener("pointerdown", finish, true);
      removeEventListener("keydown", finish, true);
      removeEventListener("hashchange", finish);
      document.removeEventListener("visibilitychange", onVisibility);
      motionQuery.removeEventListener("change", onMotionChange);
      if (!disposed) setPlaying(false);
    }

    function onVisibility() {
      if (document.hidden) finish();
    }

    function onMotionChange(event: MediaQueryListEvent) {
      if (event.matches) finish();
    }

    finishRef.current = finish;
    setPlaying(true);
    addEventListener("wheel", finish, { passive: true, capture: true });
    addEventListener("pointerdown", finish, { passive: true, capture: true });
    addEventListener("keydown", finish, { capture: true });
    addEventListener("hashchange", finish);
    document.addEventListener("visibilitychange", onVisibility);
    motionQuery.addEventListener("change", onMotionChange);

    return () => {
      disposed = true;
      finish();
      finishRef.current = () => {};
    };
  }, []);

  if (!playing) return null;

  return (
    <div
      className="signature-intro"
      aria-hidden="true"
      inert
      style={{ "--intro-duration": `${ELF_INTRO_DURATION}ms` } as CSSProperties}
      onAnimationEnd={(event) => {
        if (event.animationName === "intro-curtain-right") finishRef.current();
      }}
    >
      <div className="intro-curtain intro-curtain-left" />
      <div className="intro-curtain intro-curtain-right" />
      <div className="intro-signature-word">
        {signatureBytes.map(({ hex, letter }, index) => (
          <span className={`intro-signature-cell intro-cell-${index}`} key={hex}>
            <span className="intro-byte">{hex}</span>
            <span className="intro-letter">{letter}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
