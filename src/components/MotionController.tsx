"use client";

import { useEffect } from "react";
import { config } from "@/lib/config";

type StyledElement = HTMLElement | SVGElement;

type PointerSurface = {
  element: HTMLElement;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
};

const INSTRUCTIONS = [0, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 5];
const ENCODED_BYTES = [0xad, 0xbc, 0xa7];
const DECODED_BYTES = ENCODED_BYTES.map((byte) => byte ^ 0xc8);
const SCENE_DURATION = config.motion.duration;
const STEP_DURATION = 0.29;
const INTRO_DURATION = 0.35;

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export default function MotionController() {
  useEffect(() => {
    const rootElement = document.getElementById("portfolio");
    if (!rootElement) return;
    const heroElement = rootElement.querySelector<HTMLElement>("[data-hero]");
    if (!heroElement) return;
    const root = rootElement;
    const hero = heroElement;
    const playbackSurface = hero.querySelector<HTMLElement>(".listing") ?? hero;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const instructionElements = Array.from(root.querySelectorAll<HTMLElement>("[data-instruction]"));
    const byteElements = Array.from(root.querySelectorAll<HTMLElement>("[data-byte]"));
    const counter = root.querySelector<HTMLElement>("[data-ecx]");
    const decodedName = root.querySelector<HTMLElement>("[data-decoded-name]");
    const revealElements = Array.from(root.querySelectorAll<StyledElement>("[data-reveal]"));
    const analysisScenes = Array.from(root.querySelectorAll<HTMLElement>("[data-analysis-scene]"));
    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-observe-section]"));
    const sectionLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-section-link]"));
    const languageLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-language-link]"));
    const pointerSurfaces: PointerSurface[] = [hero, ...analysisScenes].map((element) => ({
      element, x: 0, y: 0, targetX: 0, targetY: 0,
    }));
    const styleCache = new WeakMap<StyledElement, Map<string, string>>();

    let reduced = motionQuery.matches;
    let heroTime = reduced ? SCENE_DURATION : 0;
    let activeSection = "";
    let frameId: number | null = null;
    let previousTimestamp: number | null = null;
    let previousStep = -2;
    let scrollDirty = true;
    let targetScroll = window.scrollY;
    let renderedScroll = targetScroll;
    let disposed = false;
    let sceneVisible = playbackSurface.getBoundingClientRect().bottom > 0 &&
      playbackSurface.getBoundingClientRect().top < window.innerHeight;

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
      root.dataset.sceneComplete = String(time >= SCENE_DURATION);
      const step = time >= SCENE_DURATION
        ? INSTRUCTIONS.length - 1
        : clamp(Math.floor((time - INTRO_DURATION) / STEP_DURATION), -1, INSTRUCTIONS.length - 1);
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

    function renderScroll() {
      scrollDirty = false;
      const viewportHeight = window.innerHeight;
      const scrollOffset = window.scrollY - renderedScroll;
      const totalScroll = document.documentElement.scrollHeight - viewportHeight;
      const progress = totalScroll > 0 ? clamp(window.scrollY / totalScroll) : 0;
      const heroBounds = hero.getBoundingClientRect();
      const heroProgress = clamp(-(heroBounds.top + scrollOffset) / Math.max(heroBounds.height * 0.9, 1));

      setStyle(root, "--scroll-progress", progress.toFixed(4));
      setStyle(root, "--hero-progress", reduced ? "0" : heroProgress.toFixed(4));

      revealElements.forEach((element) => {
        const bounds = element.getBoundingClientRect();
        const top = bounds.top + scrollOffset;
        const reveal = clamp((viewportHeight - top) / (viewportHeight + bounds.height * 0.35));
        const travel = clamp((top + bounds.height * 0.5 - viewportHeight * 0.5) /
          (viewportHeight * 0.5 + bounds.height * 0.5), -1, 1);
        setStyle(element, "--reveal", reduced ? "1" : reveal.toFixed(4));
        setStyle(element, "--section-travel", reduced ? "0" : travel.toFixed(4));
      });

      analysisScenes.forEach((scene) => {
        const bounds = scene.getBoundingClientRect();
        const top = bounds.top + scrollOffset;
        const sceneProgress = clamp((viewportHeight * 0.85 - top) /
          (viewportHeight * 0.5 + bounds.height * 0.35));
        const travel = clamp((top + bounds.height * 0.5 - viewportHeight * 0.5) /
          (viewportHeight * 0.5 + bounds.height * 0.5), -1, 1);
        setStyle(scene, "--analysis-progress", reduced ? "1" : sceneProgress.toFixed(4));
        setStyle(scene, "--analysis-travel", reduced ? "0" : travel.toFixed(4));
      });

      let nextSection = "";
      sections.forEach((section) => {
        if (section.getBoundingClientRect().top <= viewportHeight * 0.42) nextSection = section.id;
      });
      if (nextSection !== activeSection) {
        activeSection = nextSection;
        root.dataset.activeSection = activeSection;
        sectionLinks.forEach((link) => {
          if (link.hash === `#${activeSection}`) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      }
    }

    function stopFrame() {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      previousTimestamp = null;
    }

    function requestFrame() {
      if (disposed || document.hidden || frameId !== null) return;
      frameId = requestAnimationFrame(update);
    }

    function update(timestamp: number) {
      frameId = null;
      if (disposed || document.hidden) {
        previousTimestamp = null;
        return;
      }
      const delta = previousTimestamp === null ? 1 / 60 : Math.min((timestamp - previousTimestamp) / 1000, 0.1);
      previousTimestamp = timestamp;
      const damping = reduced ? 1 : 1 - Math.exp(-delta * 14);
      const scrollDifference = targetScroll - renderedScroll;
      const scrollMoving = Math.abs(scrollDifference) > 0.1;
      renderedScroll = scrollMoving ? renderedScroll + scrollDifference * damping : targetScroll;
      if (scrollDirty || scrollDifference !== 0) renderScroll();

      let pointerMoving = false;
      pointerSurfaces.forEach((surface) => {
        const differenceX = surface.targetX - surface.x;
        const differenceY = surface.targetY - surface.y;
        const moving = Math.abs(differenceX) + Math.abs(differenceY) > 0.001;
        surface.x = moving ? surface.x + differenceX * damping : surface.targetX;
        surface.y = moving ? surface.y + differenceY * damping : surface.targetY;
        setStyle(surface.element, "--pointer-x", surface.x.toFixed(4));
        setStyle(surface.element, "--pointer-y", surface.y.toFixed(4));
        pointerMoving ||= moving;
      });

      const timelineActive = !reduced && sceneVisible && heroTime < SCENE_DURATION;
      if (timelineActive) {
        heroTime = Math.min(SCENE_DURATION, heroTime + delta);
        renderTimeline(heroTime);
        const sweep = -220 + heroTime / SCENE_DURATION * 1320;
        setStyle(root, "--sweep", `${sweep.toFixed(1)}px`);
      }
      if (timelineActive || scrollMoving || pointerMoving) requestFrame();
      else previousTimestamp = null;
    }

    function onScroll() {
      targetScroll = window.scrollY;
      scrollDirty = true;
      requestFrame();
    }

    function onVisibilityChange() {
      if (document.hidden) stopFrame();
      else onScroll();
    }

    function onPointerMove(event: PointerEvent) {
      if (reduced || !pointerQuery.matches) return;
      const surface = pointerSurfaces.find((item) => item.element === event.currentTarget);
      if (!surface) return;
      const bounds = surface.element.getBoundingClientRect();
      surface.targetX = clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
      surface.targetY = clamp((event.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1);
      requestFrame();
    }

    function onPointerLeave(event: PointerEvent) {
      const surface = pointerSurfaces.find((item) => item.element === event.currentTarget);
      if (!surface) return;
      surface.targetX = 0;
      surface.targetY = 0;
      requestFrame();
    }

    function resetPointers() {
      pointerSurfaces.forEach((surface) => {
        surface.targetX = 0;
        surface.targetY = 0;
      });
      requestFrame();
    }

    function onReducedMotionChange(event: MediaQueryListEvent) {
      reduced = event.matches;
      root.dataset.reducedMotion = String(reduced);
      renderedScroll = targetScroll = window.scrollY;
      if (reduced) {
        heroTime = SCENE_DURATION;
        renderTimeline(SCENE_DURATION);
        setStyle(root, "--sweep", "1100px");
      }
      resetPointers();
      onScroll();
    }

    function preserveLanguageAnchor(event: MouseEvent) {
      const link = event.currentTarget as HTMLAnchorElement;
      const destination = link.getAttribute("href")?.split("#")[0];
      if (!destination) return;
      const hash = window.location.hash || (activeSection ? `#${activeSection}` : "");
      link.setAttribute("href", `${destination}${hash}`);
    }

    const visibilityObserver = new IntersectionObserver((entries) => {
      sceneVisible = entries[0].isIntersecting;
      requestFrame();
    });
    visibilityObserver.observe(playbackSurface);
    const resizeObserver = new ResizeObserver(onScroll);
    resizeObserver.observe(root);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionQuery.addEventListener("change", onReducedMotionChange);
    pointerQuery.addEventListener("change", resetPointers);
    pointerSurfaces.forEach(({ element }) => {
      element.addEventListener("pointermove", onPointerMove, { passive: true });
      element.addEventListener("pointerleave", onPointerLeave);
    });
    languageLinks.forEach((link) => link.addEventListener("click", preserveLanguageAnchor));

    root.dataset.motionReady = "true";
    root.dataset.reducedMotion = String(reduced);
    renderTimeline(heroTime);
    setStyle(root, "--sweep", reduced ? "1100px" : "-220px");
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
      pointerQuery.removeEventListener("change", resetPointers);
      pointerSurfaces.forEach(({ element }) => {
        element.removeEventListener("pointermove", onPointerMove);
        element.removeEventListener("pointerleave", onPointerLeave);
      });
      languageLinks.forEach((link) => link.removeEventListener("click", preserveLanguageAnchor));
      delete root.dataset.motionReady;
    };
  }, []);

  return null;
}
