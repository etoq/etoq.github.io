"use client";

import { useEffect } from "react";
import { config } from "@/lib/config";

type MotionLabels = {
  pause: string;
  resume: string;
};

type StyledElement = HTMLElement | SVGElement;

const INSTRUCTIONS = [0, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 5];
const ENCODED_BYTES = [0xad, 0xbc, 0xa7];
const DECODED_BYTES = ENCODED_BYTES.map((byte) => byte ^ 0xc8);
const SCENE_DURATION = config.motion.duration;
const STEP_DURATION = 0.43;
const INTRO_DURATION = 0.6;

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export default function MotionController({ labels }: { labels: MotionLabels }) {
  useEffect(() => {
    const rootElement = document.getElementById("portfolio");
    if (!rootElement) return;
    const heroElement = rootElement.querySelector<HTMLElement>("[data-hero]");
    if (!heroElement) return;
    const root = rootElement;
    const hero = heroElement;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const instructionElements = Array.from(
      root.querySelectorAll<HTMLElement>("[data-instruction]"),
    );
    const byteElements = Array.from(root.querySelectorAll<HTMLElement>("[data-byte]"));
    const counter = root.querySelector<HTMLElement>("[data-ecx]");
    const decodedName = root.querySelector<HTMLElement>("[data-decoded-name]");
    const revealElements = Array.from(
      root.querySelectorAll<StyledElement>("[data-reveal]"),
    );
    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("[data-observe-section]"),
    );
    const sectionLinks = Array.from(
      root.querySelectorAll<HTMLAnchorElement>("[data-section-link]"),
    );
    const pauseButtons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-motion="pause"]'),
    );
    const replayButtons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-motion="replay"]'),
    );
    const languageLinks = Array.from(
      root.querySelectorAll<HTMLAnchorElement>("[data-language-link]"),
    );
    const styleCache = new WeakMap<StyledElement, Map<string, string>>();

    let reduced = motionQuery.matches;
    let paused = false;
    let manualPlayback = false;
    let heroStarted = false;
    let heroTime = reduced ? SCENE_DURATION : 0;
    let ambientTime = 0;
    let activeSection = "";
    let frameId: number | null = null;
    let previousTimestamp: number | null = null;
    let previousPaint = 0;
    let previousStep = -2;
    let scrollDirty = true;
    let disposed = false;
    let rootVisible = true;
    let heroVisible = hero.getBoundingClientRect().bottom > 0 &&
      hero.getBoundingClientRect().top < window.innerHeight;

    function setStyle(element: StyledElement, property: string, value: string) {
      let properties = styleCache.get(element);
      if (!properties) {
        properties = new Map();
        styleCache.set(element, properties);
      }
      if (properties.get(property) === value) return;
      properties.set(property, value);
      element.style.setProperty(property, value);
    }

    function renderTimeline(time: number) {
      const complete = String(time >= SCENE_DURATION);
      if (root.dataset.sceneComplete !== complete) root.dataset.sceneComplete = complete;
      const step = time >= SCENE_DURATION
        ? INSTRUCTIONS.length - 1
        : clamp(
          Math.floor((time - INTRO_DURATION) / STEP_DURATION),
          -1,
          INSTRUCTIONS.length - 1,
        );
      if (step === previousStep) return;
      previousStep = step;

      const instruction = step < 0 ? -1 : INSTRUCTIONS[step];
      const decodedCount = clamp(Math.floor((step + 3) / 4), 0, 3);
      const remaining = 3 - clamp(Math.floor((step + 1) / 4), 0, 3);
      const currentByte = step >= 1 && step < 13 ? Math.floor((step - 1) / 4) : -1;

      instructionElements.forEach((element) => {
        element.classList.toggle("is-current", Number(element.dataset.instruction) === instruction);
      });
      byteElements.forEach((element) => {
        const index = Number(element.dataset.byte);
        const done = index < decodedCount;
        const byte = done ? DECODED_BYTES[index] : ENCODED_BYTES[index];
        element.textContent = byte.toString(16).padStart(2, "0");
        element.dataset.done = String(done);
        element.dataset.current = String(index === currentByte);
      });
      if (counter) counter.textContent = String(remaining);
      if (decodedName) decodedName.textContent = "eto".slice(0, decodedCount).padEnd(3, "·");
    }

    function renderControls() {
      root.dataset.motionPaused = String(paused);
      root.dataset.reducedMotion = String(reduced);
      pauseButtons.forEach((button) => {
        button.textContent = paused ? labels.resume : labels.pause;
        button.setAttribute("aria-pressed", String(paused));
      });
    }

    function renderScroll() {
      scrollDirty = false;
      const viewportHeight = window.innerHeight;
      const heroBounds = hero.getBoundingClientRect();
      const totalScroll = document.documentElement.scrollHeight - viewportHeight;
      const progress = totalScroll > 0 ? clamp(window.scrollY / totalScroll) : 0;
      const heroProgress = clamp(-heroBounds.top / Math.max(heroBounds.height * 0.9, 1));

      setStyle(root, "--scroll-progress", reduced ? "1" : progress.toFixed(4));
      setStyle(root, "--hero-progress", reduced ? "0" : heroProgress.toFixed(4));

      revealElements.forEach((element) => {
        const bounds = element.getBoundingClientRect();
        const reveal = clamp((viewportHeight - bounds.top) / (viewportHeight + bounds.height * 0.35));
        setStyle(element, "--reveal", reduced ? "1" : reveal.toFixed(4));
      });

      let nextSection = "";
      sections.forEach((section) => {
        if (section.getBoundingClientRect().top <= viewportHeight * 0.42) {
          nextSection = section.id;
        }
      });
      if (nextSection !== activeSection) {
        activeSection = nextSection;
        root.dataset.activeSection = activeSection;
        sectionLinks.forEach((link) => {
          if (link.hash === `#${activeSection}`) {
            link.setAttribute("aria-current", "location");
          } else {
            link.removeAttribute("aria-current");
          }
        });
      }
    }

    function stopFrame() {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      previousTimestamp = null;
    }

    function requestFrame() {
      if (disposed || paused || document.hidden || !rootVisible || frameId !== null) return;
      frameId = requestAnimationFrame(update);
    }

    function update(timestamp: number) {
      frameId = null;
      if (disposed || paused || document.hidden || !rootVisible) {
        previousTimestamp = null;
        return;
      }

      const delta = previousTimestamp === null
        ? 0
        : Math.min((timestamp - previousTimestamp) / 1000, 0.1);
      previousTimestamp = timestamp;

      if (scrollDirty) renderScroll();

      if (!heroStarted && heroVisible && !reduced) {
        heroStarted = true;
        heroTime = 0;
        previousStep = -2;
      }
      if (heroStarted && heroVisible && heroTime < SCENE_DURATION) {
        heroTime = Math.min(SCENE_DURATION, heroTime + delta);
        renderTimeline(heroTime);
      }

      if (!reduced) {
        ambientTime += delta;
        if (timestamp - previousPaint >= 32) {
          const sweep = -220 + (ambientTime % config.motion.ambientDuration) /
            config.motion.ambientDuration * 1320;
          setStyle(root, "--sweep", `${sweep.toFixed(1)}px`);
          setStyle(root, "--flow", (-ambientTime * 42).toFixed(1));
          previousPaint = timestamp;
        }
      }

      const timelineActive = heroStarted && heroVisible && heroTime < SCENE_DURATION;
      if (!reduced || (manualPlayback && timelineActive)) requestFrame();
    }

    function onScroll() {
      scrollDirty = true;
      requestFrame();
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stopFrame();
      } else {
        scrollDirty = true;
        requestFrame();
      }
    }

    function onPause() {
      paused = !paused;
      renderControls();
      if (paused) {
        stopFrame();
      } else {
        scrollDirty = true;
        requestFrame();
      }
    }

    function onReplay() {
      heroStarted = true;
      heroTime = 0;
      ambientTime = 0;
      previousStep = -2;
      previousTimestamp = null;
      manualPlayback = true;
      paused = false;
      renderControls();
      renderTimeline(0);
      requestFrame();
    }

    function onReducedMotionChange(event: MediaQueryListEvent) {
      reduced = event.matches;
      manualPlayback = false;
      heroStarted = false;
      heroTime = reduced ? SCENE_DURATION : 0;
      previousStep = -2;
      previousTimestamp = null;
      scrollDirty = true;
      renderControls();
      if (reduced) {
        renderTimeline(SCENE_DURATION);
        setStyle(root, "--sweep", "1100px");
        setStyle(root, "--flow", "0");
      }
      if (!paused) {
        renderScroll();
        requestFrame();
      }
    }

    function preserveLanguageAnchor(event: MouseEvent) {
      const link = event.currentTarget as HTMLAnchorElement;
      const destination = link.getAttribute("href")?.split("#")[0];
      if (!destination) return;
      const hash = window.location.hash || (activeSection ? `#${activeSection}` : "");
      link.setAttribute("href", `${destination}${hash}`);
    }

    const visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === root) rootVisible = entry.isIntersecting;
        if (entry.target === hero) heroVisible = entry.isIntersecting;
      });
      if (rootVisible) requestFrame();
      else stopFrame();
    });
    visibilityObserver.observe(root);
    visibilityObserver.observe(hero);

    const resizeObserver = new ResizeObserver(onScroll);
    resizeObserver.observe(root);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionQuery.addEventListener("change", onReducedMotionChange);
    pauseButtons.forEach((button) => button.addEventListener("click", onPause));
    replayButtons.forEach((button) => button.addEventListener("click", onReplay));
    languageLinks.forEach((link) => link.addEventListener("click", preserveLanguageAnchor));

    root.dataset.motionReady = "true";
    renderControls();
    renderTimeline(reduced ? SCENE_DURATION : 0);
    renderScroll();
    requestFrame();
    document.fonts.ready.then(() => {
      if (!disposed) onScroll();
    });

    return () => {
      disposed = true;
      stopFrame();
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onReducedMotionChange);
      pauseButtons.forEach((button) => button.removeEventListener("click", onPause));
      replayButtons.forEach((button) => button.removeEventListener("click", onReplay));
      languageLinks.forEach((link) => link.removeEventListener("click", preserveLanguageAnchor));
      delete root.dataset.motionReady;
    };
  }, [labels.pause, labels.resume]);

  return null;
}
