"use client";

import { useEffect, useRef } from "react";
import { ELF_FRAME_EVENT, elfInstructions, type ElfFrame } from "@/lib/elf";

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

const planeNames = ["ELF header", ".text", ".rodata", ".data"];
const materialNames = ["analyze.py", "notes.md", "rule.yar"];
const profileNames = ["linux", "reverse", "ctf"];
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

export default function ElfBackdrop() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!host || !canvas || !context) return;
    const drawing = context;
    const surface = canvas;
    const element = host;
    const textures: HTMLCanvasElement[] = [];
    const locale = document.documentElement.lang;
    const channelNames = locale === "ru" ? ["GitHub", "Почта", "Telegram"] : ["GitHub", "Email", "Telegram"];

    let frame = initialFrame;
    let width = 0;
    let height = 0;
    let headerBottom = 96;
    let footerHeight = 65;
    let copyTop = 320;
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

    function camera(): Camera {
      const mobile = width < 760;
      const regionTop = headerBottom + (mobile ? 14 : 24);
      const regionBottom = mobile ? copyTop - 18 : height - footerHeight - 40;
      const availableHeight = Math.max(80, regionBottom - regionTop);
      const verticalExtent = interpolate([4.3, 6.2, 4.1, 4.1], frame.phase);
      const horizontalScale = mobile ? width / 8.65 : width / 13;
      const scale = Math.min(horizontalScale, availableHeight / verticalExtent, mobile ? 52 : 104);
      const preferredCenter = mobile ? Math.min(258, Math.max(205, height * 0.34)) : height * 0.46;
      const halfExtent = scale * verticalExtent / 2;
      return {
        yaw: interpolate([-0.4, -0.63, 0.28, -0.22], frame.phase) + frame.pointerX * 0.085,
        pitch: interpolate([-0.29, -0.43, -0.15, -0.2], frame.phase) + frame.pointerY * 0.055,
        separation: interpolate([0.33, 1.35, 0.25, 0.45], frame.phase),
        cx: width * (mobile ? 0.5 : 0.67),
        cy: clamp(preferredCenter, regionTop + halfExtent, regionBottom - halfExtent),
        scale,
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

    function drawPlanes(view: Camera, opacity: number) {
      const planes = planeNames.map((name, index) => {
        const z = planeZ(index, view);
        const offset = (index - 1.5) * 0.13 * smooth(1 - Math.abs(frame.phase - 1));
        return { index, name, z, offset, depth: project([0, 0, z], view).z };
      }).sort((first, second) => second.depth - first.depth);
      drawing.save();
      drawing.globalAlpha = opacity;
      for (const plane of planes) {
        const x = plane.offset;
        const corners: Point[] = [[-3 + x, -1.66, plane.z], [3 + x, -1.66, plane.z], [3 + x, 1.66, plane.z], [-3 + x, 1.66, plane.z]];
        const origin = project(corners[0], view);
        const horizontal = project(corners[1], view);
        const vertical = project(corners[3], view);
        drawing.save();
        drawing.globalAlpha *= mix(0.4, 1, focusWeight(plane.index));
        drawing.shadowColor = "#0abab529";
        drawing.shadowBlur = 20;
        polygon(corners, view, "#061714f2", plane.index === 2 ? "#68bdab" : "#2c6858");
        drawing.shadowBlur = 0;
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
          const cycle = frame.reduced ? -1 : (frame.time % 8) / 0.38;
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
      drawing.globalAlpha = opacity;
      const index = selection[1];
      const z = planeZ(index + 1, view);
      const end: Point = [3.4, 0.7 - index * 0.6, z];
      path([[2.8, end[1], z], end], view, "#9cf5e6");
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
      drawing.globalAlpha = opacity;
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
      drawing.shadowColor = "#0abab5";
      drawing.shadowBlur = 20;
      drawing.beginPath();
      drawing.arc(x, y, 2.5, 0, Math.PI * 2);
      drawing.fillStyle = "#d6fff1";
      drawing.fill();
      drawing.shadowBlur = 0;
      drawing.fillStyle = "#a1eedc";
      drawing.font = `400 11px ${mono}`;
      const word = t < 0.5 ? ["6c 69 6e 75 78", "72 65 76", "63 74 66"][selected] : profileNames[selected];
      drawing.fillText(word, clamp(x + 8, 18, width - drawing.measureText(word).width - 18), y + 4);
      drawing.restore();
    }

    function drawTrace(view: Camera, opacity: number) {
      drawing.save();
      drawing.globalAlpha = opacity;
      const z = planeZ(1, view) - 0.025;
      const rail = -3.22;
      const selected = selection[2];
      path([[rail, instructionY(0), z], [rail, instructionY(6), z]], view, "#4baf98");
      path([[2.95, instructionY(5), z], [3.25, instructionY(5), z], [3.25, instructionY(2), z], [2.95, instructionY(2), z]], view, "#0abab5");
      polygon([[3.04, instructionY(2) - 0.055, z], [2.94, instructionY(2), z], [3.04, instructionY(2) + 0.055, z]], view, "#9cf5e6");
      stopRows.forEach((row, index) => {
        const point = project([rail, instructionY(row), z], view);
        const active = index === selected;
        path([[rail, instructionY(row), z], [-2.86, instructionY(row), z]], view, active ? "#9cf5e6" : "#376f60");
        drawing.beginPath();
        drawing.arc(point.x, point.y, active ? 5 : 3, 0, Math.PI * 2);
        drawing.fillStyle = active ? "#9cf5e6" : "#09251f";
        drawing.strokeStyle = active ? "#c0fff0" : "#4baf98";
        drawing.shadowColor = "#0abab5";
        drawing.shadowBlur = active ? 20 : 0;
        drawing.fill();
        drawing.stroke();
        drawing.shadowBlur = 0;
      });
      const selectedRow = stopRows[selected];
      const point = project([rail, mix(instructionY(0), instructionY(selectedRow), lineFlight), z], view);
      drawing.beginPath();
      drawing.arc(point.x, point.y, 3, 0, Math.PI * 2);
      drawing.fillStyle = "#d7fff2";
      drawing.shadowColor = "#0abab5";
      drawing.shadowBlur = 20;
      drawing.fill();
      drawing.shadowBlur = 0;
      const tag = project([-2.8, -1.92, z], view);
      drawing.font = `400 12px ${mono}`;
      drawing.fillStyle = "#b9f8e8";
      drawing.fillText(`break *0x${(0x401000 + elfInstructions[selectedRow].offset).toString(16)}`, Math.max(18, tag.x), tag.y);
      drawing.restore();
    }

    function drawSymbols(view: Camera, opacity: number) {
      drawing.save();
      drawing.globalAlpha = opacity;
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
      for (let index = 0; index < 3; index++) {
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
          drawing.shadowColor = "#0abab5";
          drawing.shadowBlur = 20;
          drawing.fill();
          drawing.shadowBlur = 0;
        }
      }
      drawing.restore();
    }

    function draw() {
      if (disposed || document.hidden || !width || textures.length < 4) return;
      drawing.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawing.fillStyle = "#020708";
      drawing.fillRect(0, 0, width, height);
      const view = camera();
      const glow = drawing.createRadialGradient(view.cx, view.cy, 0, view.cx, view.cy, width * 0.58);
      glow.addColorStop(0, "#0abab514");
      glow.addColorStop(1, "#0abab500");
      drawing.fillStyle = glow;
      drawing.fillRect(0, 0, width, height);
      drawing.save();
      drawing.globalAlpha = 0.4;
      for (let index = -5; index <= 5; index++) {
        path([[-5, index * 0.7, -2], [5, index * 0.7, -2]], view, "#1b3f34", 0.6);
        path([[index, -3.5, -2], [index, 3.5, -2]], view, "#1b3f34", 0.6);
      }
      drawing.restore();
      const traceOpacity = smooth(1 - Math.abs(frame.phase - 2));
      const symbolOpacity = smooth(1 - Math.abs(frame.phase - 3));
      drawPlanes(view, 1 - symbolOpacity * 0.82);
      if (frame.phase > 0 && frame.phase < 2) drawMaterialLabel(view, smooth(1 - Math.abs(frame.phase - 1)));
      if (traceOpacity > 0) drawTrace(view, traceOpacity);
      if (symbolOpacity > 0) drawSymbols(view, symbolOpacity);
      if (width >= 760) {
        const shade = drawing.createLinearGradient(0, 0, width, 0);
        shade.addColorStop(0, "#020708eb");
        shade.addColorStop(0.34, "#020708b0");
        shade.addColorStop(0.52, "#02070800");
        drawing.fillStyle = shade;
        drawing.fillRect(0, 0, width, height);
      }
      if (frame.phase < 0.75) drawExtraction(view, 1 - smooth((frame.phase - 0.35) / 0.4));
    }

    function updateFrame(event: Event) {
      const next = (event as CustomEvent<ElfFrame>).detail;
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
      draw();
    }

    function resize() {
      resizeFrame = null;
      if (disposed) return;
      const bounds = element.getBoundingClientRect();
      width = bounds.width || innerWidth;
      height = bounds.height || innerHeight;
      headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 96;
      footerHeight = document.querySelector(".site-footer")?.getBoundingClientRect().height ?? 65;
      const panel = document.querySelector(".scene-panel");
      copyTop = panel ? parseFloat(getComputedStyle(panel).paddingTop) : 320;
      pixelRatio = Math.min(devicePixelRatio || 1, 1.5);
      surface.width = Math.round(width * pixelRatio);
      surface.height = Math.round(height * pixelRatio);
      mono = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "monospace";
      createTextures();
      draw();
      element.dataset.ready = "true";
    }

    function scheduleResize() {
      if (resizeFrame === null) resizeFrame = requestAnimationFrame(resize);
    }

    const observer = new ResizeObserver(scheduleResize);
    observer.observe(element);
    addEventListener(ELF_FRAME_EVENT, updateFrame);
    addEventListener("visibilitychange", scheduleResize);
    resize();
    document.fonts.ready.then(() => { if (!disposed) scheduleResize(); });
    return () => {
      disposed = true;
      observer.disconnect();
      removeEventListener(ELF_FRAME_EVENT, updateFrame);
      removeEventListener("visibilitychange", scheduleResize);
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      textures.length = 0;
    };
  }, []);

  return (
    <div className="elf-backdrop" ref={hostRef} aria-hidden="true">
      <canvas ref={canvasRef} data-elf-canvas />
      <pre className="elf-fallback">{"7f 45 4c 46\n.text\n.rodata\n.data"}</pre>
    </div>
  );
}
