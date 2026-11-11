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

function ease(value: number) {
  const progress = clamp(value);
  return progress * progress * (3 - 2 * progress);
}

export default function MotionController() {
  useEffect(() => {
    const rootElement = document.getElementById("portfolio");
    if (!rootElement) return;
    const root = rootElement;
    const scenes = Array.from(root.querySelectorAll<HTMLElement>("[data-scene]"));
    const panels = scenes.map((scene) => scene.querySelector<HTMLElement>(".scene-panel")!);
    const contents = panels.map((panel) => panel.querySelector<HTMLElement>(".scene-content")!);
    const profileItems = Array.from(root.querySelectorAll<HTMLElement>("[data-profile-item]"));
    const contentOverflow = scenes.map(() => 0);
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
    let sceneMetrics: Array<{ start: number; distance: number }> = [];

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

    function measureLayout() {
      const viewport = innerHeight;
      let previousIndex = 0;
      sceneMetrics.forEach((metric, index) => {
        if (scrollY >= metric.start) previousIndex = index;
      });
      const previousMetric = sceneMetrics[previousIndex];
      const previousFraction = previousMetric ? clamp((scrollY - previousMetric.start) / previousMetric.distance) : 0;
      contents.forEach((content, index) => {
        const style = getComputedStyle(panels[index]);
        const available = panels[index].clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        contentOverflow[index] = reduced ? 0 : Math.max(0, content.scrollHeight - available);
        const holdDistance = viewport * 1.35 + contentOverflow[index] * 1.2;
        const trackHeight = index === scenes.length - 1 ? viewport + holdDistance : holdDistance;
        setStyle(scenes[index], "--track-height", `${Math.ceil(trackHeight)}px`);
        scenes[index].dataset.overflow = String(contentOverflow[index] > 0);
      });
      sceneMetrics = scenes.map((scene, index) => ({
        start: scene.offsetTop,
        distance: Math.max(1, scene.offsetHeight - (index === scenes.length - 1 ? viewport : 0)),
      }));
      if (previousMetric && !reduced) {
        const current = sceneMetrics[previousIndex];
        const destination = current.start + previousFraction * current.distance;
        if (Math.abs(destination - scrollY) > 1) {
          scrollTo({ top: destination, behavior: "instant" });
          renderedScroll = scrollY;
        }
      }
      targetScroll = scrollY;
      scrollDirty = true;
      requestFrame();
    }

    function renderScroll() {
      scrollDirty = false;
      const viewport = innerHeight;
      const lastIndex = scenes.length - 1;
      const maximumScroll = document.documentElement.scrollHeight - viewport;
      progress = maximumScroll > 0 ? clamp(scrollY / maximumScroll) : 0;
      setStyle(root, "--scroll-progress", progress.toFixed(5));
      if (progressLabel) progressLabel.textContent = `${Math.round(progress * 100)}%`;

      let stageIndex = 0;
      sceneMetrics.forEach((metric, index) => {
        if (renderedScroll >= metric.start) stageIndex = index;
      });
      const stage = sceneMetrics[stageIndex];
      const fraction = clamp((renderedScroll - stage.start) / stage.distance);
      scenePosition = Math.min(lastIndex, stageIndex + fraction);
      const foregroundPosition = Math.min(lastIndex, stageIndex + ease((fraction - 0.68) / 0.32));
      const dominantIndex = Math.round(foregroundPosition);
      const nextSection = scenes[dominantIndex].id;
      heroVisible = foregroundPosition < 1;
      setStyle(root, "--hero-progress", "0");

      const focusedScene = scenes.find((scene) => scene.contains(document.activeElement));
      scenes.forEach((scene, index) => {
        const difference = foregroundPosition - index;
        const visibility = ease(1 - Math.abs(difference) * 2);
        const localProgress = index === stageIndex ? fraction : index < stageIndex ? 1 : 0;
        const holdProgress = ease((localProgress - 0.03) / 0.62);
        const active = index === dominantIndex;
        setStyle(scene, "--scene-opacity", reduced ? "1" : visibility.toFixed(4));
        setStyle(scene, "--scene-scale", reduced ? "1" : (0.97 + visibility * 0.03).toFixed(4));
        setStyle(scene, "--scene-x", reduced ? "0px" : `${((difference > 0 ? -1 : 1) * (1 - visibility) * 24).toFixed(2)}px`);
        setStyle(scene, "--scene-blur", reduced ? "0px" : `${((1 - visibility) * 5).toFixed(2)}px`);
        setStyle(scene, "--content-pan", `${(contentOverflow[index] * holdProgress).toFixed(2)}px`);
        setStyle(scene, "--scene-reveal", reduced ? "1" : holdProgress.toFixed(4));
        scene.dataset.visible = String(reduced || active || visibility > 0.001);
        scene.dataset.active = String(active);
        scene.inert = !reduced && !active;
        scene.setAttribute("aria-hidden", String(!reduced && !active));
      });
      if (!reduced && focusedScene && focusedScene !== scenes[dominantIndex]) {
        const heading = scenes[dominantIndex].querySelector<HTMLElement>("h1, h2");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      }
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

      const learningProgress = stageIndex === 2 ? ease(fraction / 0.65) : stageIndex > 2 ? 1 : 0;
      if (consoleCommand) consoleCommand.textContent = command.slice(0, Math.floor(clamp(learningProgress * 4) * command.length));
      if (reduced && consoleCommand) consoleCommand.textContent = command;
      consoleRows.forEach((row, index) => {
        const reveal = reduced ? 1 : clamp((learningProgress - 0.12 - index * 0.2) / 0.22);
        setStyle(row, "--row-reveal", reveal.toFixed(4));
        row.dataset.current = String(reveal > 0 && reveal < 1);
      });
      const profileProgress = stageIndex === 1 ? ease(fraction / 0.65) : stageIndex > 1 ? 1 : 0;
      profileItems.forEach((item, index) => {
        const reveal = reduced || index < 3 ? 1 : clamp((profileProgress + 0.1 - (index - 3) * 0.18) / 0.24);
        setStyle(item, "--profile-reveal", reveal.toFixed(4));
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
      const delta = elapsedDelta || 1 / 60;
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
      measureLayout();
      const current = scenes.find((scene) => scene.id === activeSection);
      if (current) scrollTo({ top: current.offsetTop, behavior: "instant" });
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
      if (destination) link.setAttribute("href", `${destination}#${activeSection}`);
    }

    function onKeyboard(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"))) return;
      const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!direction) return;
      event.preventDefault();
      const index = scenes.findIndex((scene) => scene.id === activeSection);
      const next = scenes[clamp(index + direction, 0, scenes.length - 1)];
      next.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
    }

    const resizeObserver = new ResizeObserver(measureLayout);
    contents.forEach((content) => resizeObserver.observe(content));
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", measureLayout, { passive: true });
    addEventListener("keydown", onKeyboard);
    addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", resetPointer);
    document.addEventListener("visibilitychange", onVisibility);
    motionQuery.addEventListener("change", onReducedMotion);
    pointerQuery.addEventListener("change", resetPointer);
    languageLinks.forEach((link) => link.addEventListener("click", preserveLanguageAnchor));
    root.dataset.motionReady = "true";
    root.dataset.reducedMotion = String(reduced);
    measureLayout();
    const initialScene = scenes.find((scene) => scene.id === location.hash.slice(1));
    if (initialScene) scrollTo({ top: initialScene.offsetTop, behavior: "instant" });
    renderedScroll = targetScroll = scrollY;
    renderLoop();
    renderScroll();
    paintCanvas();
    requestFrame();
    document.fonts.ready.then(() => { if (!disposed) measureLayout(); });

    return () => {
      disposed = true;
      stopFrame();
      resizeObserver.disconnect();
      scenes.forEach((scene) => {
        scene.inert = false;
        scene.removeAttribute("aria-hidden");
      });
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", measureLayout);
      removeEventListener("keydown", onKeyboard);
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
