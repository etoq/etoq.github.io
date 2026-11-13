"use client";

import { useEffect, useRef } from "react";
import { ELF_FRAME_EVENT, elfInstructions, sceneCenterX, sceneCenterY, type ElfFrame } from "@/lib/elf";
import { createAssemblyWorld } from "@/lib/assembly-world";
import type { Locale } from "@/lib/content";

type Point = readonly [number, number, number];
type ScreenPoint = { x: number; y: number; z: number };
type Camera = {
  yaw: number;
  pitch: number;
  separation: number;
  cx: number;
  cy: number;
  scale: number;
};
type FocusTransition = { from: number[]; to: number[]; startedAt: number };
type HitTarget = { x: number; y: number; width: number; height: number; point: ScreenPoint };
type RectangleGlow = { image: HTMLCanvasElement; width: number; height: number; padding: number };

const planeNames = ["ELF header", ".text", ".rodata", ".data"];
const materialNames = ["analyze.py", "notes.md", "rule.yar"];
const profileNames = ["linux", "reverse", "ctf"];
const localizedNames = {
  ru: {
    channels: ["GitHub", "Почта", "Telegram"],
    achievements: ["CTF", "Исследование", "Публикация"],
    groups: ["Обо мне в схеме ELF", "Материалы образца", "Точки останова достижений", "Символы контактов"],
  },
  en: {
    channels: ["GitHub", "Email", "Telegram"],
    achievements: ["CTF", "Research", "Publication"],
    groups: ["About me in the ELF scene", "Sample materials", "Achievement breakpoints", "Contact symbols"],
  },
};
const stopRows = [2, 5, 6];
const decoderSteps = [0, 1, 2, 3, 4, 5, 2, 3, 4, 5, 2, 3, 4, 5, 6];
const initialFrame: ElfFrame = {
  phase: 0,
  time: 0,
  pointerX: 0,
  pointerY: 0,
  reduced: false,
  selected: [0, 0, 0, 0],
};

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function smooth(value: number) {
  const bounded = clamp(value);
  return bounded * bounded * (3 - 2 * bounded);
}

function mix(from: number, to: number, fraction: number) {
  return from + (to - from) * fraction;
}

function interpolate(values: readonly number[], phase: number) {
  const index = Math.min(values.length - 2, Math.floor(phase));
  return mix(values[index], values[index + 1], smooth(phase - index));
}

function instructionY(row: number) {
  return -1.66 + (111 + row * 35) / 400 * 3.32;
}

function spaceRows(positions: number[], minimumGap: number) {
  const spaced = [...positions];
  for (let index = 1; index < spaced.length; index++) {
    spaced[index] = Math.max(spaced[index], spaced[index - 1] + minimumGap);
  }
  const shift = (positions.reduce((sum, value) => sum + value, 0) - spaced.reduce((sum, value) => sum + value, 0)) / positions.length;
  return spaced.map((position) => position + shift);
}

export default function ElfBackdrop({ locale, onSelect }: { locale: Locale; onSelect?: (scene: number, item: number) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactionRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const onSelectRef = useRef(onSelect);
  const localeRef = useRef(locale);
  onSelectRef.current = onSelect;
  localeRef.current = locale;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!host || !canvas || !context) return;
    const drawing = context;
    const surface = canvas;
    const element = host;
    const interactions = interactionRef.current;
    const buttons = buttonRefs.current.filter((button): button is HTMLButtonElement => button !== null);
    if (!interactions || buttons.length !== 3) return;
    const textures: HTMLCanvasElement[] = [];
    const assemblyWorld = createAssemblyWorld();
    const styleCache = new WeakMap<HTMLElement, Map<string, string>>();

    let frame = initialFrame;
    let width = 0;
    let height = 0;
    let headerBottom = 96;
    let footerHeight = 65;
    let copyTop = 320;
    let copyRight = 0;
    let copyTops = [320, 320, 320, 320];
    let copyRights = [0, 0, 0, 0];
    let compactTrace = false;
    let pixelRatio = 1;
    let mono = "monospace";
    let disposed = false;
    let resizeFrame: number | null = null;
    let activeStage = 0;
    let selection = [0, 0, 0, 0];
    let flightStartedAt = -1;
    let lineFlight = 1;
    let projectFocus = [1, 0, 0];
    let focusTransition: FocusTransition | null = null;
    let hoveredItem = -1;
    let focusedItem = -1;

    function createRectangleGlow(glowWidth: number, glowHeight: number, color: string, fill: string, stroke?: string): RectangleGlow {
      const padding = 64;
      const image = document.createElement("canvas");
      image.width = glowWidth + padding * 2;
      image.height = glowHeight + padding * 2;
      const ink = image.getContext("2d");
      if (ink) {
        ink.shadowColor = color;
        ink.shadowBlur = 28;
        ink.fillStyle = fill;
        ink.fillRect(padding, padding, glowWidth, glowHeight);
        if (stroke) {
          ink.strokeStyle = stroke;
          ink.strokeRect(padding, padding, glowWidth, glowHeight);
        }
        ink.clearRect(padding - 2, padding - 2, glowWidth + 4, glowHeight + 4);
      }
      return { image, width: glowWidth, height: glowHeight, padding };
    }

    // Rasterize large soft shadows once. Repainting their blur on every frame
    // makes Canvas rendering expensive even when the JavaScript work is small.
    const planeGlow = createRectangleGlow(720, 400, "#0abab529", "#061714f2");
    const profileGlow = createRectangleGlow(210, 70, "#0abab5", "#0abab51a", "#b0ffec");
    const materialGlow = createRectangleGlow(720, 400, "#0abab5", "#0abab508", "#9cf5e6a8");
    const symbolGlow = createRectangleGlow(348, 62, "#0abab5", "#0abab526", "#9cf5e6a8");

    function createPointGlow(radius: number, ring = false) {
      const image = document.createElement("canvas");
      image.width = image.height = 80;
      const ink = image.getContext("2d");
      if (ink) {
        ink.shadowColor = "#0abab5";
        ink.shadowBlur = ring ? 18 : 20;
        ink.fillStyle = ink.strokeStyle = "#d6fff1";
        ink.beginPath();
        ink.arc(40, 40, radius, 0, Math.PI * 2);
        if (ring) ink.stroke();
        else ink.fill();
        ink.shadowBlur = 0;
        ink.globalCompositeOperation = "destination-out";
        if (ring) { ink.lineWidth = 2; ink.stroke(); }
        else ink.fill();
      }
      return image;
    }

    const flightGlow = createPointGlow(2.5);
    const traceGlow = createPointGlow(3);
    const breakpointGlow = createPointGlow(5);
    const ringGlow = createPointGlow(10, true);

    function drawPointGlow(x: number, y: number, glow: HTMLCanvasElement) {
      drawing.drawImage(glow, x - glow.width / 2, y - glow.height / 2);
    }

    function setStyle(target: HTMLElement, property: string, value: string) {
      let cache = styleCache.get(target);
      if (!cache) { cache = new Map(); styleCache.set(target, cache); }
      if (cache.get(property) === value) return;
      cache.set(property, value);
      target.style.setProperty(property, value);
    }

    function createTextures() {
      textures.length = 0;
      for (let plane = 0; plane < planeNames.length; plane++) {
        const texture = document.createElement("canvas");
        texture.width = 720;
        texture.height = 400;
        const ink = texture.getContext("2d");
        if (!ink) continue;
        ink.fillStyle = "#061614";
        ink.fillRect(0, 0, 720, 400);
        ink.strokeStyle = "#27554c";
        ink.lineWidth = 1;
        ink.strokeRect(0.5, 0.5, 719, 399);
        ink.fillStyle = "#9ce6db";
        ink.font = `400 23px ${mono}`;
        ink.fillText(planeNames[plane], 24, 36);
        ink.fillStyle = "#568f83";
        ink.font = `400 14px ${mono}`;
        ink.fillText(["7f 45 4c 46 / ELF64", "00401000 / r-x", "00402000 / r--", "00403000 / rw-"][plane], 24, 62);
        ink.strokeStyle = "#1b3d35";
        ink.beginPath();
        ink.moveTo(22, 79);
        ink.lineTo(698, 79);
        ink.stroke();
        if (plane === 1) {
          elfInstructions.forEach((instruction, row) => {
            const y = 117 + row * 35;
            ink.font = `400 17px ${mono}`;
            ink.fillStyle = "#4d7e70";
            ink.fillText((0x401000 + instruction.offset).toString(16), 25, y);
            ink.fillStyle = "#70a997";
            ink.fillText(instruction.bytes, 134, y);
            ink.fillStyle = "#bbdfd3";
            ink.fillText(instruction.code, 350, y);
          });
        } else {
          const payloads = [
            [0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [],
            Array.from(new TextEncoder().encode("linux\0reverse\0ctf\0")),
            [0xad, 0xbc, 0xa7, 0, 0, 0, 0, 0],
          ];
          const payload = payloads[plane];
          ink.font = `400 16px ${mono}`;
          for (let row = 0; row < 8; row++) {
            for (let column = 0; column < 15; column++) {
              const value = payload[(row * 15 + column) % payload.length];
              ink.fillStyle = (column + row) % 5 === 0 ? "#79b7a5" : "#366e5e";
              ink.fillText(value.toString(16).padStart(2, "0"), 25 + column * 45, 112 + row * 31);
            }
          }
          if (plane === 2) {
            ink.fillStyle = "#082a22";
            ink.fillRect(15, 176, 690, 80);
            ink.fillStyle = "#a2f2de";
            ink.font = `400 25px ${mono}`;
            profileNames.forEach((name, index) => ink.fillText(name, 30 + index * 215, 225));
          }
          if (plane === 3) {
            ink.fillStyle = "#092a23";
            ink.fillRect(15, 301, 690, 71);
            ink.fillStyle = "#a1eddb";
            ink.font = `400 25px ${mono}`;
            ink.fillText("ad bc a7  xor c8  65 74 6f", 30, 346);
          }
        }
        textures.push(texture);
      }
    }

    function camera(world: ReturnType<typeof assemblyWorld.draw>): Camera {
      const mobile = width < 760;
      copyTop = interpolate(copyTops, frame.phase);
      copyRight = interpolate(copyRights, frame.phase);
      const energy = frame.reduced ? 0 : (frame.energy ?? 0) * (frame.quality === "lite" ? 0.4 : 1);
      const velocity = frame.reduced ? 0 : (frame.velocity ?? 0) * (frame.quality === "lite" ? 0.4 : 1);
      const regionTop = headerBottom + (mobile ? 14 : 24);
      const regionBottom = mobile ? copyTop - 18 : height - footerHeight - 40;
      const availableHeight = Math.max(80, regionBottom - regionTop);
      const verticalExtent = interpolate([4.3, 6.2, 4.1, 4.1], frame.phase);
      const horizontalScale = mobile ? width / 8.65 : width / interpolate([13, 13, 14, 15], frame.phase);
      const scale = Math.min(horizontalScale, availableHeight / verticalExtent, mobile ? 52 : 104);
      const preferredCenter = mobile ? Math.min(258, Math.max(205, height * 0.34)) : height * interpolate(sceneCenterY, frame.phase);
      const halfExtent = scale * verticalExtent / 2;
      const arrival = smooth((world.arrival - 0.1) / 0.9);
      return {
        yaw: interpolate([-0.4, -0.63, 0.28, -0.22], frame.phase) + frame.pointerX * 0.085 + (1 - arrival) * 0.2 + velocity * 0.04,
        pitch: interpolate([-0.29, -0.43, -0.15, -0.2], frame.phase) + frame.pointerY * 0.055 - (1 - arrival) * 0.12 + energy * 0.025,
        separation: interpolate([0.33, 1.35, 0.25, 0.45], frame.phase) * (1 + energy * 0.12),
        cx: mix(world.focusX, width * (mobile ? 0.5 : interpolate(sceneCenterX, frame.phase)), arrival),
        cy: mix(world.focusY, clamp(preferredCenter, regionTop + halfExtent, regionBottom - halfExtent), arrival),
        scale: scale * (0.14 + 0.86 * arrival) * (1 - energy * 0.07),
      };
    }

    function project(point: Point, view: Camera): ScreenPoint {
      const x = point[0] * Math.cos(view.yaw) + point[2] * Math.sin(view.yaw);
      const depth = -point[0] * Math.sin(view.yaw) + point[2] * Math.cos(view.yaw);
      const y = point[1] * Math.cos(view.pitch) - depth * Math.sin(view.pitch);
      const z = point[1] * Math.sin(view.pitch) + depth * Math.cos(view.pitch);
      return { x: view.cx + x * view.scale, y: view.cy + y * view.scale, z };
    }

    function path(points: readonly Point[], view: Camera, stroke: string, lineWidth = 1) {
      drawing.beginPath();
      points.forEach((point, index) => {
        const transformed = project(point, view);
        if (index === 0) drawing.moveTo(transformed.x, transformed.y);
        else drawing.lineTo(transformed.x, transformed.y);
      });
      drawing.strokeStyle = stroke;
      drawing.lineWidth = lineWidth;
      drawing.stroke();
    }

    function polygon(points: readonly Point[], view: Camera, fill: string, stroke?: string) {
      drawing.beginPath();
      points.forEach((point, index) => {
        const transformed = project(point, view);
        if (index === 0) drawing.moveTo(transformed.x, transformed.y);
        else drawing.lineTo(transformed.x, transformed.y);
      });
      drawing.closePath();
      drawing.fillStyle = fill;
      drawing.fill();
      if (stroke) {
        drawing.strokeStyle = stroke;
        drawing.lineWidth = 1;
        drawing.stroke();
      }
    }

    function drawRectangleGlow(points: readonly Point[], view: Camera, glow: RectangleGlow) {
      if (frame.quality === "lite") return;
      const origin = project(points[0], view);
      const horizontal = project(points[1], view);
      const vertical = project(points[3], view);
      drawing.save();
      drawing.transform(
        (horizontal.x - origin.x) / glow.width, (horizontal.y - origin.y) / glow.width,
        (vertical.x - origin.x) / glow.height, (vertical.y - origin.y) / glow.height,
        origin.x, origin.y,
      );
      drawing.drawImage(glow.image, -glow.padding, -glow.padding);
      drawing.restore();
    }

    function focusWeight(index: number) {
      const profile = index === 2 ? 1 - smooth(frame.phase) : 0;
      const material = index > 0 ? projectFocus[index - 1] * smooth(1 - Math.abs(frame.phase - 1)) : 0;
      const execution = index === 1 ? smooth(1 - Math.abs(frame.phase - 2)) : 0;
      return clamp(profile + material + execution);
    }

    function planeZ(index: number, view: Camera) {
      const base = (index - 1.5) * view.separation;
      return mix(base, -1.5 * view.separation - 0.38, focusWeight(index));
    }

    function planeOffset(index: number) {
      return (index - 1.5) * 0.13 * smooth(1 - Math.abs(frame.phase - 1));
    }

    function planeCorners(index: number, view: Camera): Point[] {
      const x = planeOffset(index);
      const z = planeZ(index, view);
      return [[-3 + x, -1.66, z], [3 + x, -1.66, z], [3 + x, 1.66, z], [-3 + x, 1.66, z]];
    }

    function profileCorners(index: number, view: Camera): Point[] {
      const left = -3 + planeOffset(2) + (22 + index * 215) / 720 * 6;
      const right = left + 210 / 720 * 6;
      const top = -1.66 + 181 / 400 * 3.32;
      const bottom = top + 70 / 400 * 3.32;
      const z = planeZ(2, view);
      return [[left, top, z], [right, top, z], [right, bottom, z], [left, bottom, z]];
    }

    function traceMarkers(view: Camera) {
      const z = planeZ(1, view);
      const minimumX = width < 760 ? 24 : copyRight + 26;
      const sources = stopRows.map((row) => project([-3.22 + planeOffset(1), instructionY(row), z], view));
      const positions = spaceRows(sources.map((source) => source.y), 46);
      return sources.map((source, index) => ({
        source,
        x: Math.max(minimumX, source.x - (compactTrace ? 24 : 0)),
        y: compactTrace ? positions[index] : source.y,
        hitY: positions[index],
      }));
    }

    function symbolRows(view: Camera) {
      const rows = [0, 1, 2].map((index) => {
        const y = -0.45 + index * 0.8;
        const left = project([-2.9, y, -0.8], view);
        const right = project([3.35, y, -0.15], view);
        return { left, right, x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
      });
      const positions = spaceRows(rows.map((row) => row.y), 46);
      return rows.map((row, index) => ({ ...row, offsetY: positions[index] - row.y, centerY: positions[index] }));
    }

    function hitTargets(view: Camera, stage: number): HitTarget[] {
      if (stage === 0) {
        return profileNames.map((_, index) => {
          const points = profileCorners(index, view).map((point) => project(point, view));
          const left = Math.min(...points.map((point) => point.x));
          const right = Math.max(...points.map((point) => point.x));
          const top = Math.min(...points.map((point) => point.y));
          const bottom = Math.max(...points.map((point) => point.y));
          const targetWidth = Math.max(44, right - left);
          const targetHeight = Math.max(44, bottom - top);
          const point = { x: (left + right) / 2, y: (top + bottom) / 2, z: 0 };
          return { x: point.x - targetWidth / 2, y: point.y - targetHeight / 2, width: targetWidth, height: targetHeight, point };
        });
      }
      if (stage === 1) {
        const mobile = width < 760;
        const targetWidth = mobile ? Math.min(96, (width - 48) / 3) : 98;
        const gap = mobile ? 8 : 14;
        const railWidth = targetWidth * 3 + gap * 2;
        const start = clamp(view.cx - railWidth / 2, mobile ? 16 : copyRight + 26, width - railWidth - 16);
        const y = mobile ? copyTop - 34 : Math.min(height - footerHeight - 38, view.cy + view.scale * 3.5);
        return [0, 1, 2].map((index) => ({
          x: start + index * (targetWidth + gap), y: y - 22, width: targetWidth, height: 44,
          point: project([-2.65 + planeOffset(index + 1), -1.45, planeZ(index + 1, view)], view),
        }));
      }
      if (stage === 2) {
        return traceMarkers(view).map((point) => ({
          x: point.x - 22, y: point.hitY - 22, width: 44, height: 44,
          point: { x: point.x, y: point.y, z: 0 },
        }));
      }
      return symbolRows(view).map((row) => ({
        x: Math.min(row.left.x, row.right.x), y: row.centerY - 22,
        width: Math.max(44, Math.abs(row.right.x - row.left.x)), height: 44,
        point: { x: row.x, y: row.centerY, z: 0 },
      }));
    }

    function updateInteractions(view: Camera, objectVisibility: number) {
      const names = localizedNames[localeRef.current];
      const interactionNames = [profileNames, [".text", ".rodata", ".data"], names.achievements, names.channels];
      const scene = document.querySelector<HTMLElement>('.story-scene[data-active="true"]');
      const stage = Number(scene?.dataset.scene ?? Math.round(frame.phase));
      const available = objectVisibility > 0.6 && Math.abs(frame.phase - stage) < 0.14 && (frame.intro ?? 1) >= 0.995;
      if (!available && interactions!.contains(document.activeElement)) {
        (document.activeElement as HTMLElement).blur();
        focusedItem = -1;
      }
      interactions!.hidden = !available;
      interactions!.dataset.elfScene = String(stage);
      element.dataset.interactionStage = available ? String(stage) : "";
      if (!available) { hoveredItem = -1; return; }
      interactions!.setAttribute("aria-label", names.groups[stage]);
      const targets = hitTargets(view, stage);
      buttons.forEach((button, index) => {
        const target = targets[index];
        setStyle(button, "left", `${target.x.toFixed(2)}px`);
        setStyle(button, "top", `${target.y.toFixed(2)}px`);
        setStyle(button, "width", `${target.width.toFixed(2)}px`);
        setStyle(button, "height", `${target.height.toFixed(2)}px`);
        button.dataset.labelVisible = String(stage === 1);
        button.dataset.elfScene = String(stage);
        button.setAttribute("aria-label", stage === 1 ? `${interactionNames[stage][index]} / ${materialNames[index]}` : interactionNames[stage][index]);
        button.setAttribute("aria-pressed", String(selection[stage] === index));
        const label = button.querySelector<HTMLElement>(".elf-hit-label");
        if (label && label.textContent !== interactionNames[stage][index]) label.textContent = interactionNames[stage][index];
      });
      if (stage === 1) {
        drawing.save();
        targets.forEach((target, index) => {
          drawing.beginPath();
          drawing.moveTo(target.point.x, target.point.y);
          drawing.lineTo(target.x + target.width / 2, target.y + 4);
          drawing.strokeStyle = index === selection[stage] ? "#73cbb47a" : "#40837450";
          drawing.lineWidth = 0.75;
          drawing.stroke();
        });
        drawing.restore();
      }
      const preview = focusedItem >= 0 ? focusedItem : hoveredItem;
      if (preview < 0) return;
      drawing.save();
      if (stage === 0) {
        const corners = profileCorners(preview, view);
        drawRectangleGlow(corners, view, profileGlow);
        polygon(corners, view, "#0abab51a", "#b0ffec");
      }
      if (stage === 1) {
        const corners = planeCorners(preview + 1, view);
        drawRectangleGlow(corners, view, materialGlow);
        polygon(corners, view, "#0abab508", "#9cf5e6a8");
      }
      if (stage === 2) {
        const target = targets[preview];
        drawPointGlow(target.point.x, target.point.y, ringGlow);
        drawing.beginPath();
        drawing.arc(target.point.x, target.point.y, 10, 0, Math.PI * 2);
        drawing.strokeStyle = "#b0ffec";
        drawing.lineWidth = 1;
        drawing.stroke();
        drawing.fillStyle = "#b0ffec";
        drawing.font = `400 11px ${mono}`;
        const label = names.achievements[preview];
        drawing.fillText(label, clamp(target.point.x + 14, 16, width - drawing.measureText(label).width - 16), target.point.y - 12);
      }
      if (stage === 3) {
        const y = -0.45 + preview * 0.8;
        drawing.translate(0, symbolRows(view)[preview].offsetY);
        const corners: Point[] = [[-2.9, y - 0.26, -0.82], [0, y - 0.26, -0.82], [0, y + 0.26, -0.82], [-2.9, y + 0.26, -0.82]];
        drawRectangleGlow(corners, view, symbolGlow);
        polygon(corners, view, "#0abab526", "#9cf5e6a8");
      }
      drawing.restore();
    }

    function drawPlanes(view: Camera, opacity: number) {
      const planes = planeNames.map((_, index) => {
        const z = planeZ(index, view);
        return { index, depth: project([0, 0, z], view).z };
      }).sort((first, second) => second.depth - first.depth);
      drawing.save();
      drawing.globalAlpha *= opacity;
      for (const plane of planes) {
        const corners = planeCorners(plane.index, view);
        const origin = project(corners[0], view);
        const horizontal = project(corners[1], view);
        const vertical = project(corners[3], view);
        drawing.save();
        drawing.globalAlpha *= mix(0.4, 1, focusWeight(plane.index));
        drawRectangleGlow(corners, view, planeGlow);
        polygon(corners, view, "#061714f2", plane.index === 2 ? "#68bdab" : "#2c6858");
        drawing.transform((horizontal.x - origin.x) / 720, (horizontal.y - origin.y) / 720, (vertical.x - origin.x) / 400, (vertical.y - origin.y) / 400, origin.x, origin.y);
        drawing.beginPath();
        drawing.rect(0, 0, 720, 400);
        drawing.clip();
        drawing.drawImage(textures[plane.index], 0, 0);
        if (plane.index === 2) {
          const index = selection[0];
          drawing.fillStyle = "#0abab526";
          drawing.fillRect(22 + index * 215, 181, 210, 70);
          drawing.strokeStyle = "#9cf5e6";
          drawing.lineWidth = 2;
          drawing.strokeRect(22 + index * 215, 181, 210, 70);
        }
        if (plane.index === 1) {
          const traceOpacity = smooth(1 - Math.abs(frame.phase - 2));
          const row = stopRows[selection[2]];
          drawing.save();
          drawing.globalAlpha *= traceOpacity;
          drawing.fillStyle = "#0abab536";
          drawing.fillRect(18, 94 + row * 35, 684, 34);
          drawing.fillStyle = "#9cf5e6";
          drawing.fillRect(18, 94 + row * 35, 3, 34);
          drawing.restore();
          const cycle = frame.reduced || frame.phase >= 1.5 ? -1 : (frame.time % 8) / 0.38;
          if (cycle >= 0 && cycle < decoderSteps.length) {
            const activeRow = decoderSteps[Math.floor(cycle)];
            drawing.fillStyle = "#0abab51e";
            drawing.fillRect(20, 95 + activeRow * 35, 680, 32);
            drawing.fillStyle = "#9cf5e6aa";
            drawing.fillRect(20, 95 + activeRow * 35, 2, 32);
          }
        }
        if (!frame.reduced && frame.phase < 1.5) {
          const cycle = frame.time % 7;
          if (cycle < 4.8) {
            const beam = -100 + cycle / 4.8 * 920;
            const glare = drawing.createLinearGradient(beam - 95, 0, beam + 12, 0);
            glare.addColorStop(0, "#0abab500");
            glare.addColorStop(0.88, "#9cf5e648");
            glare.addColorStop(1, "#9cf5e600");
            drawing.fillStyle = glare;
            drawing.fillRect(beam - 95, 0, 107, 400);
          }
        }
        drawing.restore();
      }
      for (const x of [-3, 3]) {
        for (const y of [-1.66, 1.66]) {
          path([[x, y, -1.5 * view.separation], [x, y, 1.5 * view.separation]], view, "#5baf9652");
        }
      }
      drawing.restore();
    }

    function drawMaterialLabel(view: Camera, opacity: number) {
      drawing.save();
      drawing.globalAlpha *= opacity;
      const index = selection[1];
      const z = planeZ(index + 1, view);
      const x = planeOffset(index + 1);
      const end: Point = [3.4 + x, 0.7 - index * 0.6, z];
      path([[2.8 + x, end[1], z], end], view, "#9cf5e6");
      const point = project(end, view);
      const name = materialNames[index];
      drawing.fillStyle = "#c7ffec";
      drawing.font = `400 ${width < 760 ? 11 : 12}px ${mono}`;
      const textWidth = drawing.measureText(name).width;
      const rightAligned = point.x + textWidth + 10 > width - 18;
      drawing.textAlign = rightAligned ? "right" : "left";
      drawing.fillText(name, rightAligned ? Math.min(point.x - 7, width - 18) : point.x + 7, point.y + 4);
      drawing.restore();
    }

    function drawExtraction(view: Camera, opacity: number) {
      const record = document.querySelector<HTMLElement>('[data-scene="0"] .elf-record');
      if (!record) return;
      const bounds = record.getBoundingClientRect();
      const copyWindow = record.closest(".scene-copy-window")?.getBoundingClientRect();
      const visibleTop = Math.max(0, copyWindow?.top ?? 0);
      const visibleBottom = Math.min(height - 30, copyWindow?.bottom ?? height);
      if (bounds.top < visibleTop || bounds.top > visibleBottom - 20) return;
      drawing.save();
      drawing.globalAlpha *= opacity;
      const selected = selection[0];
      const source = project([-2.5 + selected * 1.9, 0.05, planeZ(2, view)], view);
      const mobile = width < 760;
      const end = { x: Math.min(bounds.right + 8, width - (mobile ? 18 : 90)), y: bounds.top + 6 };
      const controlA = { x: mobile ? width - 18 : source.x - 90, y: source.y };
      const controlB = { x: mobile ? width - 12 : end.x + 85, y: mobile ? end.y - 35 : end.y };
      drawing.beginPath();
      drawing.moveTo(source.x, source.y);
      drawing.bezierCurveTo(controlA.x, controlA.y, controlB.x, controlB.y, end.x, end.y);
      drawing.strokeStyle = "#65bfa155";
      drawing.lineWidth = 1;
      drawing.stroke();
      const t = lineFlight;
      const u = 1 - t;
      const x = u * u * u * source.x + 3 * u * u * t * controlA.x + 3 * u * t * t * controlB.x + t * t * t * end.x;
      const y = u * u * u * source.y + 3 * u * u * t * controlA.y + 3 * u * t * t * controlB.y + t * t * t * end.y;
      drawPointGlow(x, y, flightGlow);
      drawing.beginPath();
      drawing.arc(x, y, 2.5, 0, Math.PI * 2);
      drawing.fillStyle = "#d6fff1";
      drawing.fill();
      drawing.fillStyle = "#a1eedc";
      drawing.font = `400 11px ${mono}`;
      const word = t < 0.5 ? ["6c 69 6e 75 78", "72 65 76", "63 74 66"][selected] : profileNames[selected];
      drawing.fillText(word, clamp(x + 8, 18, width - drawing.measureText(word).width - 18), y + 4);
      drawing.restore();
    }

    function drawTrace(view: Camera, opacity: number) {
      drawing.save();
      drawing.globalAlpha *= opacity;
      const z = planeZ(1, view);
      const offset = planeOffset(1);
      const rail = -3.22 + offset;
      const selected = selection[2];
      path([[rail, instructionY(0), z], [rail, instructionY(6), z]], view, "#4baf98");
      path([[2.95 + offset, instructionY(5), z], [3.25 + offset, instructionY(5), z], [3.25 + offset, instructionY(2), z], [2.95 + offset, instructionY(2), z]], view, "#0abab5");
      polygon([[3.04 + offset, instructionY(2) - 0.055, z], [2.94 + offset, instructionY(2), z], [3.04 + offset, instructionY(2) + 0.055, z]], view, "#9cf5e6");
      const markers = traceMarkers(view);
      stopRows.forEach((row, index) => {
        const point = markers[index];
        const active = index === selected;
        path([[rail, instructionY(row), z], [-2.86 + offset, instructionY(row), z]], view, active ? "#9cf5e6" : "#376f60");
        drawing.beginPath();
        drawing.moveTo(point.source.x, point.source.y);
        drawing.lineTo(point.x, point.y);
        drawing.strokeStyle = active ? "#9cf5e6a8" : "#376f6080";
        drawing.lineWidth = 1;
        drawing.stroke();
        drawing.beginPath();
        drawing.arc(point.x, point.y, active ? 5 : 3, 0, Math.PI * 2);
        drawing.fillStyle = active ? "#9cf5e6" : "#09251f";
        drawing.strokeStyle = active ? "#c0fff0" : "#4baf98";
        if (active) drawPointGlow(point.x, point.y, breakpointGlow);
        drawing.fill();
        drawing.stroke();
      });
      const selectedRow = stopRows[selected];
      const marker = markers[selected];
      const railPoint = project([rail, mix(instructionY(0), instructionY(selectedRow), Math.min(1, lineFlight / 0.8)), z], view);
      const markerFlight = smooth((lineFlight - 0.8) / 0.2);
      const point = { x: mix(railPoint.x, marker.x, markerFlight), y: mix(railPoint.y, marker.y, markerFlight) };
      drawing.beginPath();
      drawing.arc(point.x, point.y, 3, 0, Math.PI * 2);
      drawing.fillStyle = "#d7fff2";
      drawPointGlow(point.x, point.y, traceGlow);
      drawing.fill();
      const tag = project([-2.8 + offset, -1.92, z], view);
      drawing.font = `400 12px ${mono}`;
      drawing.fillStyle = "#b9f8e8";
      drawing.fillText(`break *0x${(0x401000 + elfInstructions[selectedRow].offset).toString(16)}`, Math.max(18, tag.x), tag.y);
      drawing.restore();
    }

    function drawSymbols(view: Camera, opacity: number) {
      const channelNames = localizedNames[localeRef.current].channels;
      drawing.save();
      drawing.globalAlpha *= opacity;
      const selected = selection[3];
      const symbolZ = -0.8;
      polygon([[-3, -1.6, symbolZ], [0.1, -1.6, symbolZ], [0.1, 1.8, symbolZ], [-3, 1.8, symbolZ]], view, "#061714f5", "#387d6e");
      polygon([[0.8, -1.6, -0.15], [3.35, -1.6, -0.15], [3.35, 1.8, -0.15], [0.8, 1.8, -0.15]], view, "#061714f5", "#387d6e");
      drawing.fillStyle = "#9cf5e6";
      drawing.font = `400 ${width < 760 ? 11 : 14}px ${mono}`;
      const origin = project([-2.78, -1.2, symbolZ], view);
      const got = project([1, -1.2, -0.15], view);
      drawing.fillText(".dynsym", origin.x, origin.y);
      drawing.fillText(".got", got.x, got.y);
      const rows = symbolRows(view);
      for (let index = 0; index < 3; index++) {
        drawing.save();
        drawing.translate(0, rows[index].offsetY);
        const y = -0.45 + index * 0.8;
        const active = index === selected;
        const line: Point[] = [[-0.05, y, symbolZ], [0.8, y, -0.15], [1.05, y, -0.15]];
        if (active) {
          polygon([[-2.9, y - 0.26, symbolZ - 0.02], [0, y - 0.26, symbolZ - 0.02], [0, y + 0.26, symbolZ - 0.02], [-2.9, y + 0.26, symbolZ - 0.02]], view, "#0abab52a");
        }
        path(line, view, active ? "#9cf5e6" : "#376f60");
        const symbol = project([-2.75, y, symbolZ], view);
        const binding = project([1.05, y, -0.15], view);
        drawing.fillStyle = active ? "#d0fff1" : "#7aaf9d";
        drawing.fillText(["github", "mail", "telegram"][index], symbol.x, symbol.y + 4);
        const state = project([-1.05, y, symbolZ], view);
        drawing.fillStyle = "#639f8c";
        drawing.font = `400 11px ${mono}`;
        drawing.fillText("UND", state.x, state.y + 4);
        drawing.font = `400 ${width < 760 ? 11 : 13}px ${mono}`;
        drawing.fillStyle = active ? "#b8fae9" : "#649f8b";
        const label = active ? channelNames[index] : "0x00000000";
        drawing.fillText(label, Math.min(binding.x, width - drawing.measureText(label).width - 18), binding.y + 4);
        if (active) {
          const t = smooth(lineFlight);
          const end = project([mix(line[0][0], line[2][0], t), y, mix(symbolZ, -0.15, t)], view);
          drawing.beginPath();
          drawing.arc(end.x, end.y, 2.5, 0, Math.PI * 2);
          drawing.fillStyle = "#d2fff1";
          drawPointGlow(end.x, end.y, flightGlow);
          drawing.fill();
        }
        drawing.restore();
      }
      drawing.restore();
    }

    function draw() {
      if (disposed || document.hidden || !width || textures.length < 4) return;
      drawing.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawing.fillStyle = "#020708";
      drawing.fillRect(0, 0, width, height);
      const world = assemblyWorld.draw(drawing, width, height, frame);
      const view = camera(world);
      const fraction = frame.phase - Math.floor(frame.phase);
      const reveal = fraction < 0.5 ? 1 : smooth((fraction - 0.72) / 0.28);
      const entrance = smooth(((frame.intro ?? 1) - 0.5) / 0.5);
      const objectVisibility = smooth((world.arrival - 0.28) / 0.72) * reveal * entrance;
      const energy = frame.reduced ? 0 : (frame.energy ?? 0) * (frame.quality === "lite" ? 0.4 : 1);
      const glow = drawing.createRadialGradient(view.cx, view.cy, 0, view.cx, view.cy, width * 0.58);
      glow.addColorStop(0, `rgba(10, 186, 181, ${0.078 + energy * 0.16})`);
      glow.addColorStop(1, "#0abab500");
      drawing.fillStyle = glow;
      drawing.fillRect(0, 0, width, height);
      const traceOpacity = smooth(1 - Math.abs(frame.phase - 2));
      const symbolOpacity = smooth(1 - Math.abs(frame.phase - 3));
      drawing.save();
      drawing.globalAlpha = objectVisibility;
      drawPlanes(view, 1 - symbolOpacity * 0.82);
      if (frame.phase > 0 && frame.phase < 2) drawMaterialLabel(view, smooth(1 - Math.abs(frame.phase - 1)));
      if (traceOpacity > 0) drawTrace(view, traceOpacity);
      if (symbolOpacity > 0) drawSymbols(view, symbolOpacity);
      drawing.restore();
      if (width >= 760) {
        const rightCopy = smooth(frame.phase - 2);
        const shade = drawing.createLinearGradient(0, 0, width, 0);
        shade.addColorStop(0, `rgba(2, 7, 8, ${0.92 * (1 - rightCopy)})`);
        shade.addColorStop(0.34, `rgba(2, 7, 8, ${0.69 * (1 - rightCopy)})`);
        shade.addColorStop(0.52, "#02070800");
        shade.addColorStop(0.68, `rgba(2, 7, 8, ${0.6 * rightCopy})`);
        shade.addColorStop(1, `rgba(2, 7, 8, ${0.94 * rightCopy})`);
        drawing.fillStyle = shade;
        drawing.fillRect(0, 0, width, height);
      }
      if (width < 760) {
        const shade = drawing.createLinearGradient(0, copyTop - 45, 0, copyTop + 40);
        shade.addColorStop(0, "#02070800");
        shade.addColorStop(1, "#020708f0");
        drawing.fillStyle = shade;
        drawing.fillRect(0, copyTop - 45, width, height - copyTop + 45);
      }
      if (frame.phase < 0.75) drawExtraction(view, (1 - smooth((frame.phase - 0.35) / 0.4)) * objectVisibility);
      updateInteractions(view, objectVisibility);
      element.dataset.worldArrival = world.arrival.toFixed(4);
      element.dataset.worldZoom = world.cameraZoom.toFixed(4);
      element.dataset.objectScale = view.scale.toFixed(3);
      element.dataset.focusX = world.focusX.toFixed(3);
      element.dataset.focusY = world.focusY.toFixed(3);
      element.dataset.renderQuality = frame.quality ?? "full";
      element.dataset.motionEnergy = energy.toFixed(4);
      element.dataset.introProgress = (frame.intro ?? 1).toFixed(4);
    }

    function updateFrame(event: Event) {
      const next = (event as CustomEvent<ElfFrame>).detail;
      const qualityChanged = (next.quality ?? "full") !== (frame.quality ?? "full");
      const nextStage = Math.round(clamp(next.phase, 0, 3));
      const nextSelection = [0, 1, 2, 3].map((index) => clamp(Math.round(next.selected[index] ?? 0), 0, 2));
      const changed = nextStage !== activeStage || nextSelection.some((value, index) => value !== selection[index]);
      if (changed) flightStartedAt = next.time;
      if (nextSelection[1] !== selection[1]) {
        const target = [0, 1, 2].map((index) => Number(index === nextSelection[1]));
        focusTransition = { from: [...projectFocus], to: target, startedAt: next.time };
      }
      selection = nextSelection;
      activeStage = nextStage;
      frame = { ...next, phase: clamp(next.phase, 0, 3) };
      lineFlight = next.reduced || flightStartedAt < 0 ? 1 : clamp((next.time - flightStartedAt) / 0.9);
      if (focusTransition) {
        const transition = focusTransition;
        const fraction = next.reduced ? 1 : smooth((next.time - transition.startedAt) / 0.65);
        projectFocus = transition.from.map((value, index) => mix(value, transition.to[index], fraction));
        if (fraction === 1) focusTransition = null;
      }
      element.dataset.phase = frame.phase.toFixed(3);
      if (qualityChanged) resize();
      else draw();
    }

    function resize() {
      resizeFrame = null;
      if (disposed) return;
      const bounds = element.getBoundingClientRect();
      width = bounds.width || innerWidth;
      height = bounds.height || innerHeight;
      headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 96;
      footerHeight = document.querySelector(".site-footer")?.getBoundingClientRect().height ?? 65;
      // Keep the marker layout stable while scroll and pointer motion change the camera.
      const traceHeight = Math.max(80, height - headerBottom - footerHeight - 64);
      const traceScale = Math.min(width / 14, traceHeight / 4.1, 104);
      compactTrace = width < 760 || traceScale * 3.32 * 35 / 400 < 24;
      const scenes = Array.from(document.querySelectorAll<HTMLElement>(".story-scene"));
      copyTops = scenes.map((scene) => parseFloat(getComputedStyle(scene.querySelector(".scene-panel")!).paddingTop));
      copyRights = scenes.map((scene) => {
        const bounds = scene.querySelector(".scene-copy-window")!.getBoundingClientRect();
        const sceneX = parseFloat(scene.style.getPropertyValue("--scene-x")) || 0;
        return bounds.right - sceneX;
      });
      pixelRatio = Math.min(devicePixelRatio || 1, frame.quality === "lite" ? 1 : 1.5);
      surface.width = Math.round(width * pixelRatio);
      surface.height = Math.round(height * pixelRatio);
      mono = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "monospace";
      assemblyWorld.rebuild(mono, pixelRatio);
      createTextures();
      draw();
      element.dataset.ready = "true";
    }

    function scheduleResize() {
      if (resizeFrame === null) resizeFrame = requestAnimationFrame(resize);
    }

    const observer = new ResizeObserver(scheduleResize);
    observer.observe(element);
    document.querySelectorAll(".scene-copy-window, .site-header").forEach((node) => observer.observe(node));
    addEventListener(ELF_FRAME_EVENT, updateFrame);
    addEventListener("visibilitychange", scheduleResize);
    const buttonListeners = buttons.map((button, index) => {
      const enter = () => { hoveredItem = index; draw(); };
      const leave = () => { hoveredItem = -1; draw(); };
      const focus = () => { focusedItem = index; draw(); };
      const blur = () => { focusedItem = -1; draw(); };
      button.addEventListener("pointerenter", enter);
      button.addEventListener("pointerleave", leave);
      button.addEventListener("focus", focus);
      button.addEventListener("blur", blur);
      return { button, enter, leave, focus, blur };
    });
    resize();
    document.fonts.ready.then(() => { if (!disposed) scheduleResize(); });
    return () => {
      disposed = true;
      observer.disconnect();
      removeEventListener(ELF_FRAME_EVENT, updateFrame);
      removeEventListener("visibilitychange", scheduleResize);
      buttonListeners.forEach(({ button, enter, leave, focus, blur }) => {
        button.removeEventListener("pointerenter", enter);
        button.removeEventListener("pointerleave", leave);
        button.removeEventListener("focus", focus);
        button.removeEventListener("blur", blur);
      });
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      assemblyWorld.dispose();
      textures.length = 0;
    };
  }, []);

  return (
    <div className="elf-backdrop" ref={hostRef}>
      <canvas ref={canvasRef} data-elf-canvas aria-hidden="true" />
      <pre className="elf-fallback" aria-hidden="true">{"7f 45 4c 46\n.text\n.rodata\n.data"}</pre>
      <div className="elf-interactions" ref={interactionRef} role="group" aria-label="ELF" hidden>
        {profileNames.map((name, index) => (
          <button
            className="elf-hit-target"
            type="button"
            data-elf-item={index}
            key={index}
            ref={(button) => { buttonRefs.current[index] = button; }}
            aria-label={name}
            aria-pressed={index === 0}
            onClick={() => {
              const rawStage = hostRef.current?.dataset.interactionStage;
              if (!rawStage) return;
              const stage = Number(rawStage);
              if (Number.isInteger(stage) && stage >= 0 && stage < 4) onSelectRef.current?.(stage, index);
            }}
          >
            <span className="elf-hit-label">{name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
