"use client";

import { useEffect } from "react";
import { ELF_FRAME_EVENT, type ElfFrame } from "@/lib/elf";

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function ease(value: number) {
  const bounded = clamp(value);
  return bounded * bounded * (3 - 2 * bounded);
}

function inverseEase(value: number) {
  return 0.5 - Math.sin(Math.asin(1 - 2 * clamp(value)) / 3);
}

type SceneMetric = { start: number; distance: number };

export default function MotionController() {
  useEffect(() => {
    const rootElement = document.getElementById("portfolio");
    if (!rootElement) return;
    const root = rootElement;
    const scenes = Array.from(root.querySelectorAll<HTMLElement>("[data-scene]"));
    const windows = scenes.map((scene) => scene.querySelector<HTMLElement>(".scene-copy-window")!);
    const contents = scenes.map((scene) => scene.querySelector<HTMLElement>(".scene-content")!);
    const navLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-section-link]"));
    const anchors = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
    const language = root.querySelector<HTMLAnchorElement>("[data-language-link]");
    const languagePath = language?.getAttribute("href") ?? "/";
    const sampleLocation = root.querySelector<HTMLElement>("[data-sample-location]");
    const consolePanel = root.querySelector<HTMLDetailsElement>(".focus-console");
    const consoleCommand = root.querySelector<HTMLElement>("[data-console-command]");
    const command = consoleCommand?.dataset.command ?? "";
    const consoleRows = Array.from(root.querySelectorAll<HTMLElement>("[data-console-row]"));
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const pointerQuery = matchMedia("(hover: hover) and (pointer: fine)");
    const styleCache = new WeakMap<HTMLElement, Map<string, string>>();
    const overflow = scenes.map(() => 0);
    let metrics: SceneMetric[] = [];
    let reduced = motionQuery.matches;
    let frameId: number | null = null;
    let layoutId: number | null = null;
    let previousTime: number | null = null;
    let lastPaint = -Infinity;
    let elapsed = 0;
    let renderedScroll = scrollY;
    let targetScroll = scrollY;
    let dirty = true;
    let activeIndex = 0;
    let phase = 0;
    let canvasTarget = 0;
    let canvasPosition = 0;
    let pointerX = 0;
    let pointerY = 0;
    let targetPointerX = 0;
    let targetPointerY = 0;
    let consoleStartedAt = 0;
    let disposed = false;

    function setStyle(element: HTMLElement, name: string, value: string) {
      let cache = styleCache.get(element);
      if (!cache) { cache = new Map(); styleCache.set(element, cache); }
      if (cache.get(name) === value) return;
      cache.set(name, value);
      element.style.setProperty(name, value);
    }

    function requestFrame() {
      if (!disposed && !document.hidden && frameId === null) frameId = requestAnimationFrame(update);
    }

    function measureLayout() {
      layoutId = null;
      if (disposed) return;
      const previousMetric = metrics[activeIndex];
      const fraction = previousMetric ? clamp((scrollY - previousMetric.start) / previousMetric.distance) : 0;
      const previousOverflow = overflow[activeIndex];
      const previousPan = parseFloat(scenes[activeIndex].style.getPropertyValue("--content-pan")) || 0;
      scenes.forEach((scene, index) => {
        overflow[index] = reduced ? 0 : Math.max(0, contents[index].scrollHeight - windows[index].clientHeight);
        const distance = innerHeight * 1.55 + overflow[index] * 1.6;
        const height = distance + (index === scenes.length - 1 ? innerHeight : 0);
        setStyle(scene, "--track-height", `${Math.ceil(height)}px`);
        scene.dataset.overflow = String(overflow[index] > 0);
      });
      metrics = scenes.map((scene, index) => ({
        start: scene.offsetTop,
        distance: Math.max(1, scene.offsetHeight - (!reduced && index === scenes.length - 1 ? innerHeight : 0)),
      }));
      if (previousMetric && !reduced) {
        const nextOverflow = overflow[activeIndex];
        const preservePan = previousOverflow !== nextOverflow && fraction < 0.72;
        const nextFraction = preservePan ? inverseEase(nextOverflow > 0 ? previousPan / nextOverflow : 0) * 0.67 : fraction;
        const destination = metrics[activeIndex].start + nextFraction * metrics[activeIndex].distance;
        if (Math.abs(destination - scrollY) > 1) scrollTo({ top: destination, behavior: "instant" });
      }
      renderedScroll = targetScroll = scrollY;
      dirty = true;
      requestFrame();
      queueMicrotask(() => {
        if (document.activeElement instanceof HTMLElement) ensureFocusVisible(document.activeElement);
      });
    }

    function scheduleLayout() {
      if (!disposed && layoutId === null) layoutId = requestAnimationFrame(measureLayout);
    }

    function renderScroll() {
      if (!metrics.length) return;
      dirty = false;
      let stage = 0;
      metrics.forEach((metric, index) => { if (renderedScroll >= metric.start) stage = index; });
      const fraction = clamp((renderedScroll - metrics[stage].start) / metrics[stage].distance);
      canvasTarget = reduced ? stage : Math.min(scenes.length - 1, stage + fraction);
      phase = reduced ? stage : Math.min(scenes.length - 1, stage + ease((fraction - 0.72) / 0.28));
      const dominant = Math.round(phase);
      const focusedScene = scenes.find((scene) => scene.contains(document.activeElement));
      scenes.forEach((scene, index) => {
        const difference = phase - index;
        const visibility = ease(1 - Math.abs(difference) * 2);
        const localProgress = index === stage ? fraction : index < stage ? 1 : 0;
        setStyle(scene, "--scene-opacity", reduced ? "1" : visibility.toFixed(4));
        setStyle(scene, "--scene-x", reduced ? "0px" : `${(-difference * 14).toFixed(2)}px`);
        setStyle(scene, "--content-pan", reduced ? "0px" : `${(overflow[index] * ease(localProgress / 0.67)).toFixed(2)}px`);
        scene.dataset.visible = String(reduced || index === dominant || visibility > 0.001);
        scene.dataset.active = String(index === dominant);
        scene.inert = !reduced && index !== dominant;
        scene.setAttribute("aria-hidden", String(!reduced && index !== dominant));
      });
      if (!reduced && focusedScene && focusedScene !== scenes[dominant]) {
        const heading = scenes[dominant].querySelector<HTMLElement>("h1, h2");
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      }
      activeIndex = dominant;
      root.dataset.activeSection = scenes[dominant].id;
      root.dataset.phase = phase.toFixed(4);
      navLinks.forEach((link) => {
        if (link.hash === `#${scenes[dominant].id}`) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
      if (language) language.href = `${languagePath}#${scenes[dominant].id}`;
      if (sampleLocation) sampleLocation.textContent = [".rodata", "sections", "trace", ".dynsym"][dominant];
      const maximum = document.documentElement.scrollHeight - innerHeight;
      setStyle(root, "--scroll-progress", maximum > 0 ? clamp(scrollY / maximum).toFixed(5) : "0");
    }

    function paintCanvas() {
      const detail: ElfFrame = {
        phase: canvasPosition, time: elapsed, pointerX, pointerY, reduced,
        selected: scenes.map((scene) => Number(scene.dataset.selected) || 0),
      };
      dispatchEvent(new CustomEvent<ElfFrame>(ELF_FRAME_EVENT, { detail }));
    }

    function renderConsole() {
      if (!consolePanel?.open) return;
      const progress = reduced ? 1 : clamp((elapsed - consoleStartedAt) / 1.6);
      if (consoleCommand) consoleCommand.textContent = command.slice(0, Math.floor(clamp(progress * 3) * command.length));
      consoleRows.forEach((row, index) => setStyle(row, "--row-reveal", (reduced ? 1 : ease((progress - 0.15 - index * 0.2) / 0.25)).toFixed(4)));
    }

    function update(timestamp: number) {
      frameId = null;
      if (disposed || document.hidden) return;
      const delta = previousTime === null ? 1 / 60 : Math.min(0.1, Math.max(0, (timestamp - previousTime) / 1000));
      previousTime = timestamp;
      elapsed += delta;
      const damping = reduced ? 1 : 1 - Math.exp(-delta * 12);
      const difference = targetScroll - renderedScroll;
      renderedScroll = Math.abs(difference) > 0.1 ? renderedScroll + difference * damping : targetScroll;
      pointerX += (targetPointerX - pointerX) * damping;
      pointerY += (targetPointerY - pointerY) * damping;
      if (reduced) pointerX = pointerY = 0;
      if (dirty || Math.abs(difference) > 0.1) renderScroll();
      canvasPosition = reduced ? canvasTarget : canvasPosition + (canvasTarget - canvasPosition) * damping;
      renderConsole();
      if (reduced || timestamp - lastPaint >= 32) { paintCanvas(); lastPaint = timestamp; }
      if (!reduced || Math.abs(difference) > 0.1) requestFrame();
      else previousTime = null;
    }

    function onScroll() { targetScroll = scrollY; dirty = true; requestFrame(); }
    function resetPointer() { targetPointerX = targetPointerY = 0; requestFrame(); }
    function onPointerMove(event: PointerEvent) {
      if (reduced || !pointerQuery.matches) return;
      targetPointerX = clamp(event.clientX / innerWidth * 2 - 1, -1, 1);
      targetPointerY = clamp(event.clientY / innerHeight * 2 - 1, -1, 1);
      requestFrame();
    }
    function goTo(index: number, updateHistory = true) {
      const target = scenes[clamp(index, 0, scenes.length - 1)];
      if (updateHistory) history.replaceState(null, "", `#${target.id}`);
      scrollTo({ top: target.offsetTop, behavior: reduced ? "instant" : "smooth" });
      onScroll();
    }
    function indexForHash(hash: string) {
      const id = ["top", "main", "learning"].includes(hash) ? "about" : hash;
      return scenes.findIndex((scene) => scene.id === id);
    }
    function onAnchor(event: MouseEvent) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.currentTarget as HTMLAnchorElement;
      const hash = anchor.hash.slice(1);
      const index = indexForHash(hash);
      if (index < 0) return;
      event.preventDefault();
      goTo(index);
      if (hash === "main") {
        const heading = scenes[index].querySelector<HTMLElement>("h1, h2");
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      }
    }
    function onKeyboard(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, button, summary"))) return;
      const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!direction) return;
      event.preventDefault();
      goTo(activeIndex + direction);
    }
    function onReducedMotion(event: MediaQueryListEvent) {
      reduced = event.matches;
      root.dataset.reducedMotion = String(reduced);
      previousTime = null;
      resetPointer();
      measureLayout();
      goTo(activeIndex, false);
    }
    function onVisibility() {
      if (document.hidden) {
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null; previousTime = null;
      } else onScroll();
    }
    function onConsoleToggle() { consoleStartedAt = elapsed; scheduleLayout(); requestFrame(); }
    function onHashChange() {
      const id = location.hash.slice(1);
      const index = indexForHash(id);
      if (id === "learning" && consolePanel) consolePanel.open = true;
      if (index >= 0) goTo(index, false);
    }
    function ensureFocusVisible(targetElement: HTMLElement) {
      if (disposed || reduced) return;
      const content = targetElement.closest<HTMLElement>(".scene-content");
      const index = content ? contents.indexOf(content) : -1;
      if (index !== activeIndex || overflow[index] <= 0) return;
      if (Math.abs(phase - index) > 0.01) return;
      scrollTo({ top: renderedScroll, behavior: "instant" });
      renderedScroll = targetScroll = scrollY;
      dirty = true;
      requestFrame();
      const windowElement = windows[index];
      windowElement.scrollTop = 0;
      const area = windowElement.getBoundingClientRect();
      const target = targetElement.getBoundingClientRect();
      let pan = parseFloat(scenes[index].style.getPropertyValue("--content-pan")) || 0;
      if (target.top < area.top + 8) pan += target.top - area.top - 8;
      else if (target.bottom > area.bottom - 24) pan += target.bottom - area.bottom + 24;
      else return;
      const fraction = inverseEase(clamp(pan / overflow[index])) * 0.67;
      scrollTo({ top: metrics[index].start + fraction * metrics[index].distance, behavior: "instant" });
      renderedScroll = targetScroll = scrollY;
      dirty = true;
      requestFrame();
    }
    function onFocus(event: FocusEvent) {
      if (event.target instanceof HTMLElement) ensureFocusVisible(event.target);
    }

    const resizeObserver = new ResizeObserver(scheduleLayout);
    contents.forEach((element) => resizeObserver.observe(element));
    const selectionObserver = new MutationObserver(() => requestFrame());
    selectionObserver.observe(root, { subtree: true, attributes: true, attributeFilter: ["data-selected"] });
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", scheduleLayout, { passive: true });
    addEventListener("pointermove", onPointerMove, { passive: true });
    addEventListener("keydown", onKeyboard);
    addEventListener("hashchange", onHashChange);
    document.addEventListener("pointerleave", resetPointer);
    document.addEventListener("visibilitychange", onVisibility);
    root.addEventListener("focusin", onFocus);
    motionQuery.addEventListener("change", onReducedMotion);
    consolePanel?.addEventListener("toggle", onConsoleToggle);
    anchors.forEach((anchor) => anchor.addEventListener("click", onAnchor));
    root.dataset.motionReady = "true";
    root.dataset.reducedMotion = String(reduced);
    measureLayout();
    const initialId = location.hash.slice(1);
    const initial = indexForHash(initialId);
    if (initial >= 0) scrollTo({ top: scenes[initial].offsetTop, behavior: "instant" });
    if (initialId === "learning" && consolePanel) consolePanel.open = true;
    renderedScroll = targetScroll = scrollY;
    renderScroll(); canvasPosition = canvasTarget; paintCanvas(); requestFrame();
    document.fonts.ready.then(() => { if (!disposed) scheduleLayout(); });

    return () => {
      disposed = true;
      if (frameId !== null) cancelAnimationFrame(frameId);
      if (layoutId !== null) cancelAnimationFrame(layoutId);
      resizeObserver.disconnect(); selectionObserver.disconnect();
      scenes.forEach((scene) => { scene.inert = false; scene.removeAttribute("aria-hidden"); });
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", scheduleLayout);
      removeEventListener("pointermove", onPointerMove);
      removeEventListener("keydown", onKeyboard);
      removeEventListener("hashchange", onHashChange);
      document.removeEventListener("pointerleave", resetPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("focusin", onFocus);
      motionQuery.removeEventListener("change", onReducedMotion);
      consolePanel?.removeEventListener("toggle", onConsoleToggle);
      anchors.forEach((anchor) => anchor.removeEventListener("click", onAnchor));
      delete root.dataset.motionReady;
    };
  }, []);

  return null;
}
