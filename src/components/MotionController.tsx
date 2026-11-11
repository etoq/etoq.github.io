"use client";

import { useEffect } from "react";
import { config } from "@/lib/config";
import { SCENE_SYMBOLS, type AssemblyFrame } from "@/lib/assembly";

const STEPS = [0, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 5];
const ENCODED = [0xad, 0xbc, 0xa7];
const INTRO = 0.35;
const STEP_DURATION = 0.29;
const LOOP_DURATION = config.motion.duration + 2;

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export default function MotionController() {
  useEffect(() => {
    const rootElement = document.getElementById("portfolio");
    if (!rootElement) return;
    const root = rootElement;
    const scenes = Array.from(root.querySelectorAll<HTMLElement>("[data-scene]"));
    const panels = scenes.map((scene) => scene.querySelector<HTMLElement>(".scene-panel")!);
    const hero = scenes[0];
    if (!hero) return;
    const instructions = Array.from(root.querySelectorAll<HTMLElement>("[data-instruction]"));
    const bytes = Array.from(root.querySelectorAll<HTMLElement>("[data-byte]"));
    const decodedName = root.querySelector<HTMLElement>("[data-decoded-name]");
    const counter = root.querySelector<HTMLElement>("[data-ecx]");
    const consoleCommand = root.querySelector<HTMLElement>("[data-console-command]");
    const command = consoleCommand?.dataset.command ?? "";
    const consoleRows = Array.from(root.querySelectorAll<HTMLElement>("[data-console-row]"));
    const navLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-section-link]"));
    const languageLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-language-link]"));
    const addressLabel = root.querySelector<HTMLElement>("[data-hud-address]");
    const symbolLabel = root.querySelector<HTMLElement>("[data-hud-symbol]");
    const sectionLabel = root.querySelector<HTMLElement>("[data-hud-section]");
    const progressLabel = root.querySelector<HTMLElement>("[data-hud-progress]");
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const pointerQuery = matchMedia("(hover: hover) and (pointer: fine)");
    const styleCache = new WeakMap<HTMLElement, Map<string, string>>();

    let reduced = motionQuery.matches;
    let frameId: number | null = null;
    let previousTime: number | null = null;
    let lastCanvasPaint = -Infinity;
    let elapsed = 0;
    let loopTime = 0;
    let loopCount = 0;
    let previousStep = -2;
    let scrollDirty = true;
    let targetScroll = scrollY;
    let renderedScroll = scrollY;
    let scenePosition = 0;
    let progress = 0;
    let pointerX = 0;
    let pointerY = 0;
    let pointerTargetX = 0;
    let pointerTargetY = 0;
    let heroVisible = true;
    let activeSection = "top";
    let disposed = false;

    function setStyle(element: HTMLElement, name: string, value: string) {
      let cache = styleCache.get(element);
      if (!cache) {
        cache = new Map();
        styleCache.set(element, cache);
      }
      if (cache.get(name) === value) return;
      cache.set(name, value);
      element.style.setProperty(name, value);
    }

    function renderLoop() {
      const time = reduced ? config.motion.duration : Math.min(loopTime, config.motion.duration);
      const step = clamp(Math.floor((time - INTRO) / STEP_DURATION), -1, STEPS.length - 1);
      root.dataset.sceneComplete = String(time >= config.motion.duration);
      root.dataset.loopCount = String(loopCount);
      setStyle(root, "--sweep", `${(-220 + time / config.motion.duration * 1320).toFixed(1)}px`);
      if (step === previousStep) return;
      previousStep = step;
      const instruction = step < 0 ? -1 : STEPS[step];
      const decodedCount = clamp(Math.floor((step + 3) / 4), 0, 3);
      const remaining = 3 - clamp(Math.floor((step + 1) / 4), 0, 3);
      instructions.forEach((element) => {
        element.classList.toggle("is-current", Number(element.dataset.instruction) === instruction);
      });
      bytes.forEach((element, index) => {
        const done = index < decodedCount;
        element.textContent = (done ? ENCODED[index] ^ 0xc8 : ENCODED[index]).toString(16).padStart(2, "0");
        element.dataset.done = String(done);
        element.dataset.current = String(step >= 1 && step < 13 && index === Math.floor((step - 1) / 4));
      });
      if (decodedName) decodedName.textContent = "eto".slice(0, decodedCount).padEnd(3, "·");
      if (counter) counter.textContent = String(remaining);
    }

    function renderScroll() {
      scrollDirty = false;
      const viewport = innerHeight;
      const maximumScroll = document.documentElement.scrollHeight - viewport;
      progress = maximumScroll > 0 ? clamp(scrollY / maximumScroll) : 0;
      setStyle(root, "--scroll-progress", progress.toFixed(5));
      setStyle(root, "--hero-progress", reduced ? "0" : clamp(renderedScroll / viewport).toFixed(4));
      if (progressLabel) progressLabel.textContent = `${Math.round(progress * 100)}%`;
      scenePosition = 0;
      let nextSection = "top";
      scenes.forEach((scene, index) => {
        const start = scene.offsetTop;
        const end = scenes[index + 1]?.offsetTop ?? start + scene.offsetHeight;
        if (renderedScroll >= start) scenePosition = Math.min(5, index + clamp((renderedScroll - start) / Math.max(1, end - start)));
        if (start <= scrollY + viewport * 0.35) nextSection = scene.id;
        const bounds = panels[index].getBoundingClientRect();
        const enter = clamp((viewport * 0.94 - bounds.top) / (viewport * 0.4));
        const exit = clamp((bounds.bottom - viewport * 0.08) / (viewport * 0.42));
        const reveal = clamp((scrollY - start + viewport * 0.65) / Math.max(viewport * 0.65, scene.offsetHeight - viewport * 0.35));
        setStyle(scene, "--scene-opacity", reduced ? "1" : Math.min(enter, exit).toFixed(4));
        setStyle(scene, "--scene-lift", reduced ? "0px" : `${((1 - enter) * 45 - (1 - exit) * 28).toFixed(2)}px`);
        setStyle(scene, "--scene-reveal", reduced ? "1" : reveal.toFixed(4));
      });
      if (nextSection !== activeSection) {
        activeSection = nextSection;
        root.dataset.activeSection = activeSection;
        navLinks.forEach((link) => {
          if (link.hash === `#${activeSection}`) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      }
      if (sectionLabel) sectionLabel.textContent = navLinks.find((link) => link.hash === `#${activeSection}`)?.textContent ?? "eto";
      const symbol = SCENE_SYMBOLS[Math.round(scenePosition)];
      if (addressLabel) addressLabel.textContent = symbol.address;
      if (symbolLabel) symbolLabel.textContent = symbol.label;

      const learning = scenes[2];
      const consoleProgress = reduced ? 1 : clamp((scrollY - learning.offsetTop + viewport * 0.65) / Math.max(1, learning.offsetHeight - viewport * 0.35));
      if (consoleCommand) consoleCommand.textContent = command.slice(0, Math.floor(clamp(consoleProgress * 4) * command.length));
      consoleRows.forEach((row, index) => {
        const reveal = reduced ? 1 : clamp((consoleProgress - 0.16 - index * 0.19) / 0.22);
        setStyle(row, "--row-reveal", reveal.toFixed(4));
        row.dataset.current = String(reveal > 0 && reveal < 1);
      });
    }

    function paintCanvas() {
      const detail: AssemblyFrame = { scene: scenePosition, progress, time: elapsed, pointerX, pointerY, reduced };
      dispatchEvent(new CustomEvent<AssemblyFrame>("eto:motion-frame", { detail }));
    }

    function requestFrame() {
      if (disposed || document.hidden || frameId !== null) return;
      frameId = requestAnimationFrame(update);
    }

    function stopFrame() {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      previousTime = null;
    }

    function update(timestamp: number) {
      frameId = null;
      if (disposed || document.hidden) return;
      const elapsedDelta = previousTime === null ? 0 : Math.max(0, (timestamp - previousTime) / 1000);
      const delta = Math.min(elapsedDelta || 1 / 60, 0.1);
      previousTime = timestamp;
      const damping = reduced ? 1 : 1 - Math.exp(-delta * 11);
      const difference = targetScroll - renderedScroll;
      renderedScroll = Math.abs(difference) > 0.1 ? renderedScroll + difference * damping : targetScroll;
      const moving = Math.abs(difference) > 0.1;
      pointerX += (pointerTargetX - pointerX) * damping;
      pointerY += (pointerTargetY - pointerY) * damping;
      if (reduced) pointerX = pointerY = 0;
      setStyle(root, "--pointer-x", pointerX.toFixed(4));
      setStyle(root, "--pointer-y", pointerY.toFixed(4));
      if (scrollDirty || moving) renderScroll();
      if (!reduced) {
        elapsed += elapsedDelta;
        if (heroVisible) {
          loopTime += elapsedDelta;
          if (loopTime >= LOOP_DURATION) {
            loopCount += Math.floor(loopTime / LOOP_DURATION);
            loopTime %= LOOP_DURATION;
          }
          renderLoop();
        }
      }
      if (reduced || timestamp - lastCanvasPaint >= 32) {
        paintCanvas();
        lastCanvasPaint = timestamp;
      }
      if (!reduced || moving) requestFrame();
      else previousTime = null;
    }

    function onScroll() {
      targetScroll = scrollY;
      scrollDirty = true;
      requestFrame();
    }

    function onPointerMove(event: PointerEvent) {
      if (reduced || !pointerQuery.matches) return;
      pointerTargetX = clamp(event.clientX / innerWidth * 2 - 1, -1, 1);
      pointerTargetY = clamp(event.clientY / innerHeight * 2 - 1, -1, 1);
      requestFrame();
    }

    function resetPointer() {
      pointerTargetX = pointerTargetY = 0;
      requestFrame();
    }

    function onReducedMotion(event: MediaQueryListEvent) {
      reduced = event.matches;
      root.dataset.reducedMotion = String(reduced);
      previousStep = -2;
      renderedScroll = targetScroll = scrollY;
      resetPointer();
      renderLoop();
      onScroll();
    }

    function onVisibility() {
      if (document.hidden) stopFrame();
      else onScroll();
    }

    function preserveLanguageAnchor(event: MouseEvent) {
      const link = event.currentTarget as HTMLAnchorElement;
      const destination = link.getAttribute("href")?.split("#")[0];
      if (destination) link.setAttribute("href", `${destination}${location.hash || `#${activeSection}`}`);
    }

    const observer = new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; });
    observer.observe(hero);
    const resizeObserver = new ResizeObserver(onScroll);
    resizeObserver.observe(root);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll, { passive: true });
    addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", resetPointer);
    document.addEventListener("visibilitychange", onVisibility);
    motionQuery.addEventListener("change", onReducedMotion);
    pointerQuery.addEventListener("change", resetPointer);
    languageLinks.forEach((link) => link.addEventListener("click", preserveLanguageAnchor));
    root.dataset.motionReady = "true";
    root.dataset.reducedMotion = String(reduced);
    renderLoop();
    renderScroll();
    paintCanvas();
    requestFrame();
    document.fonts.ready.then(() => { if (!disposed) onScroll(); });

    return () => {
      disposed = true;
      stopFrame();
      observer.disconnect();
      resizeObserver.disconnect();
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", resetPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      motionQuery.removeEventListener("change", onReducedMotion);
      pointerQuery.removeEventListener("change", resetPointer);
      languageLinks.forEach((link) => link.removeEventListener("click", preserveLanguageAnchor));
      delete root.dataset.motionReady;
    };
  }, []);

  return null;
}
