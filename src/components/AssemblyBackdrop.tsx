"use client";

import { useEffect, useRef } from "react";
import { assemblyBlocks, type AssemblyBlock, type AssemblyFrame } from "@/lib/assembly";

type Camera = { x: number; y: number; zoom: number; angle: number; focus: string };
type Connection = { from: string; to: string; bend: number; label?: string };

const cameras: Camera[] = [
  { x: 730, y: 215, zoom: 0.8, angle: -0.12, focus: "header" },
  { x: 250, y: -80, zoom: 0.95, angle: -0.055, focus: "entry" },
  { x: 440, y: 1025, zoom: 0.95, angle: 0.045, focus: "decode" },
  { x: 1390, y: 370, zoom: 0.86, angle: -0.085, focus: "sections" },
  { x: 1060, y: 1330, zoom: 0.97, angle: -0.04, focus: "done" },
  { x: 1640, y: 1050, zoom: 1.02, angle: 0.045, focus: "data" },
];

const connections: Connection[] = [
  { from: "entry", to: "header", bend: 0.25 },
  { from: "header", to: "sections", bend: 0.45, label: "ELF64" },
  { from: "header", to: "reject", bend: -0.7, label: "jne" },
  { from: "sections", to: "strings", bend: 0.35 },
  { from: "strings", to: "decode", bend: -0.25 },
  { from: "decode", to: "decode", bend: -1, label: "jnz" },
  { from: "decode", to: "done", bend: 0.45, label: "ecx = 0" },
  { from: "strings", to: "data", bend: 0.4, label: "rip-relative" },
];

const initialFrame: AssemblyFrame = {
  scene: 0, progress: 0, time: 0, pointerX: 0, pointerY: 0, reduced: false,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function blockHeight(block: AssemblyBlock) {
  return 62 + block.instructions.length * 33;
}

export default function AssemblyBackdrop() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!host || !canvas || !context) return;
    const drawing = context;
    const blockById = new Map(assemblyBlocks.map((block) => [block.id, block]));
    const blockTextures = new Map<string, HTMLCanvasElement>();
    const grid = new Path2D();
    const crosses = new Path2D();
    for (let x = -1000; x <= 2900; x += 100) {
      grid.moveTo(x, -1300);
      grid.lineTo(x, 2300);
    }
    for (let y = -1300; y <= 2300; y += 100) {
      grid.moveTo(-1000, y);
      grid.lineTo(2900, y);
    }
    for (let x = -800; x <= 2800; x += 400) {
      for (let y = -1200; y <= 2200; y += 400) {
        crosses.moveTo(x - 4, y);
        crosses.lineTo(x + 4, y);
        crosses.moveTo(x, y - 4);
        crosses.lineTo(x, y + 4);
      }
    }

    let frame = initialFrame;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let disposed = false;
    let monoFamily = "monospace";

    function makeBlockTextures() {
      blockTextures.clear();
      assemblyBlocks.forEach((block) => {
        const texture = document.createElement("canvas");
        texture.width = Math.ceil((block.width + 32) * pixelRatio);
        texture.height = Math.ceil((blockHeight(block) + 26) * pixelRatio);
        const ink = texture.getContext("2d");
        if (!ink) return;
        ink.scale(pixelRatio, pixelRatio);
        ink.translate(10, 10);
        const surface = ink.createLinearGradient(0, 0, block.width, blockHeight(block));
        surface.addColorStop(0, "rgba(7, 22, 24, 0.93)");
        surface.addColorStop(0.75, "rgba(3, 12, 15, 0.65)");
        surface.addColorStop(1, "rgba(3, 12, 15, 0.02)");
        ink.fillStyle = surface;
        ink.fillRect(0, 0, block.width, blockHeight(block));
        ink.strokeStyle = "rgba(83, 141, 127, 0.45)";
        ink.lineWidth = 1;
        ink.beginPath();
        ink.moveTo(0, blockHeight(block));
        ink.lineTo(0, 0);
        ink.lineTo(block.width, 0);
        ink.stroke();
        ink.strokeStyle = "rgba(54, 114, 102, 0.2)";
        ink.beginPath();
        ink.moveTo(72, 39);
        ink.lineTo(72, blockHeight(block) - 12);
        ink.moveTo(0, 39);
        ink.lineTo(block.width, 39);
        ink.stroke();
        ink.font = `500 15px ${monoFamily}`;
        ink.fillStyle = "#8bc9b9";
        ink.fillText(`${block.label}:`, 16, 25);
        ink.font = `400 10px ${monoFamily}`;
        ink.fillStyle = "rgba(122, 175, 159, 0.72)";
        ink.textAlign = "right";
        ink.fillText(`0x${block.address.toString(16)}`, block.width - 12, 24);
        ink.textAlign = "left";
        let address = block.address;
        block.instructions.forEach((instruction, index) => {
          const baseline = 65 + index * 33;
          const bytes = block.bytes[index];
          ink.font = `400 10px ${monoFamily}`;
          ink.fillStyle = "rgba(95, 156, 137, 0.72)";
          ink.fillText(address.toString(16).slice(-4), 14, baseline);
          ink.font = `400 9px ${monoFamily}`;
          ink.fillStyle = "rgba(97, 152, 138, 0.53)";
          ink.fillText(bytes, 86, baseline);
          const separator = instruction.indexOf(" ");
          const opcode = separator < 0 ? instruction : instruction.slice(0, separator);
          const operand = separator < 0 ? "" : instruction.slice(separator).trim();
          ink.font = `400 14px ${monoFamily}`;
          ink.fillStyle = "#b4d8c9";
          ink.fillText(opcode, 224, baseline);
          ink.fillStyle = "#7da895";
          ink.fillText(operand, 278, baseline);
          address += bytes ? bytes.split(" ").length : 0;
        });
        blockTextures.set(block.id, texture);
      });
    }

    function drawAddressField(cameraX: number, cameraY: number) {
      drawing.save();
      drawing.translate(cameraX * 0.14, cameraY * 0.12 - 180);
      drawing.scale(1.08, 0.92);
      drawing.lineWidth = 0.7;
      drawing.strokeStyle = "rgba(42, 94, 85, 0.12)";
      drawing.stroke(grid);
      drawing.strokeStyle = "rgba(78, 153, 130, 0.28)";
      drawing.stroke(crosses);
      drawing.font = `400 10px ${monoFamily}`;
      for (let rail = 0; rail < 3; rail++) {
        const x = rail * 950 - 550;
        drawing.strokeStyle = "rgba(74, 155, 128, 0.17)";
        drawing.beginPath();
        drawing.moveTo(x, -900);
        drawing.lineTo(x, 2100);
        drawing.stroke();
        for (let row = 0; row < 22; row++) {
          const y = row * 120 - 700;
          drawing.fillStyle = row % 4 === 0 ? "rgba(83, 163, 139, 0.35)" : "rgba(63, 120, 106, 0.2)";
          drawing.fillText((0x401000 + row * 0x20 + rail * 0x1000).toString(16).padStart(8, "0"), x + 12, y);
          drawing.fillRect(x - 4, y - 4, 8, 1);
        }
      }
      drawing.restore();
    }

    function drawConnection(connection: Connection, index: number, focus: string) {
      const from = blockById.get(connection.from)!;
      const to = blockById.get(connection.to)!;
      const active = from.id === focus || to.id === focus;
      const loop = from === to;
      const startX = loop ? from.x : from.x + from.width * 0.7;
      const startY = from.y + blockHeight(from) - 8;
      const endX = loop ? to.x : to.x + 20;
      const endY = loop ? to.y + 78 : to.y;
      const controlX = loop ? startX - 140 : (startX + endX) / 2 + connection.bend * 220;
      drawing.beginPath();
      drawing.moveTo(startX, startY);
      drawing.bezierCurveTo(controlX, startY + 110, controlX, endY - 110, endX, endY);
      drawing.lineWidth = active ? 1.4 : 0.8;
      drawing.strokeStyle = active ? "rgba(55, 187, 164, 0.66)" : "rgba(41, 111, 96, 0.35)";
      drawing.stroke();
      drawing.setLineDash([active ? 24 : 8, 280]);
      drawing.lineDashOffset = frame.reduced ? 0 : -frame.time * (active ? 42 : 20) - index * 53;
      drawing.strokeStyle = active ? "rgba(173, 255, 228, 0.9)" : "rgba(108, 209, 179, 0.4)";
      drawing.stroke();
      drawing.setLineDash([]);
      drawing.fillStyle = active ? "#9cf5df" : "#316e5e";
      drawing.fillRect(endX - 2, endY - 2, 4, 4);
      if (connection.label) {
        drawing.font = `400 10px ${monoFamily}`;
        drawing.fillStyle = active ? "#78bfa7" : "#345d50";
        drawing.fillText(connection.label, controlX + 12, (startY + endY) / 2);
      }
    }

    function drawBlock(block: AssemblyBlock, focus: string) {
      const texture = blockTextures.get(block.id);
      if (!texture) return;
      const active = block.id === focus;
      const depthX = frame.reduced ? 0 : frame.pointerX * block.depth * 0.13;
      const depthY = frame.reduced ? 0 : frame.pointerY * block.depth * 0.075;
      drawing.save();
      drawing.translate(block.x + depthX, block.y + depthY);
      drawing.transform(1, -block.depth * 0.00032, -0.035, 1, 0, 0);
      drawing.globalAlpha = active ? 1 : 0.66;
      drawing.drawImage(texture, -10, -10, texture.width / pixelRatio, texture.height / pixelRatio);
      drawing.globalAlpha = 1;
      if (active) {
        const lineIndex = frame.reduced ? 0 : Math.floor(frame.time / 0.58) % block.instructions.length;
        const baseline = 65 + lineIndex * 33;
        const light = drawing.createLinearGradient(0, 0, block.width, 0);
        light.addColorStop(0, "rgba(10, 186, 181, 0.22)");
        light.addColorStop(1, "rgba(10, 186, 181, 0)");
        drawing.fillStyle = light;
        drawing.fillRect(0, baseline - 22, block.width, 32);
        drawing.fillStyle = "#9cf5e6";
        drawing.fillRect(0, baseline - 21, 2, 30);
        drawing.fillStyle = "rgba(156, 245, 230, 0.75)";
        drawing.beginPath();
        drawing.moveTo(-13, baseline - 10);
        drawing.lineTo(-7, baseline - 6);
        drawing.lineTo(-13, baseline - 2);
        drawing.fill();
        drawing.strokeStyle = "rgba(120, 231, 199, 0.84)";
        drawing.shadowColor = "rgba(10, 186, 181, 0.6)";
        drawing.shadowBlur = 8;
        drawing.beginPath();
        drawing.moveTo(0, 22);
        drawing.lineTo(0, 0);
        drawing.lineTo(36, 0);
        drawing.stroke();
      }
      drawing.restore();
    }

    function drawMemoryRibbon(cameraX: number, cameraY: number) {
      drawing.save();
      drawing.translate(580 - cameraX * 0.045, 1445 - cameraY * 0.035);
      drawing.transform(1, -0.14, 0.3, 0.7, 0, 0);
      const byteValues = ["7f", "45", "4c", "46", "02", "01", "01", "00", "ad", "bc", "a7", "00", "65", "74", "6f", "00"];
      drawing.font = `400 19px ${monoFamily}`;
      const selected = frame.reduced ? 8 : 8 + Math.floor(frame.time / 0.72) % 3;
      byteValues.forEach((byte, index) => {
        const x = index * 48;
        drawing.fillStyle = index === selected ? "rgba(10, 186, 181, 0.16)" : "rgba(3, 16, 18, 0.5)";
        drawing.fillRect(x, -28, 40, 49);
        drawing.fillStyle = index === selected ? "#a6f7df" : "#3e7966";
        drawing.fillText(byte, x + 7, 2);
        drawing.fillStyle = index === selected ? "#0abab5" : "#183e32";
        drawing.fillRect(x, 20, 40, 1);
      });
      drawing.font = `400 10px ${monoFamily}`;
      drawing.fillStyle = "#32624f";
      drawing.fillText(".data  0x00404020", 0, -47);
      drawing.restore();
    }

    function draw() {
      if (disposed || !width || !height) return;
      const scene = frame.reduced ? 0 : clamp(frame.scene, 0, cameras.length - 1);
      const cameraIndex = Math.floor(scene);
      const current = cameras[cameraIndex];
      const next = cameras[Math.min(cameraIndex + 1, cameras.length - 1)];
      const fraction = scene - cameraIndex;
      const blend = fraction * fraction * (3 - 2 * fraction);
      const cameraX = current.x + (next.x - current.x) * blend;
      const cameraY = current.y + (next.y - current.y) * blend;
      const zoom = current.zoom + (next.zoom - current.zoom) * blend;
      const angle = current.angle + (next.angle - current.angle) * blend;
      const focus = blend < 0.5 ? current.focus : next.focus;
      const mobile = width < 760;
      const scale = (mobile ? 0.62 : clamp(width / 1600, 0.72, 1.16)) * zoom;
      const pointerX = frame.reduced ? 0 : frame.pointerX * 16;
      const pointerY = frame.reduced ? 0 : frame.pointerY * 10;
      drawing.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawing.fillStyle = "#020708";
      drawing.fillRect(0, 0, width, height);
      drawing.save();
      drawing.translate(width * (mobile ? 0.68 : 0.72) + pointerX, height * (mobile ? 0.63 : 0.5) + pointerY);
      drawing.rotate(angle);
      drawing.transform(1, -0.065, -0.12, 1, 0, 0);
      drawing.scale(scale, scale);
      drawing.translate(-cameraX, -cameraY);
      drawAddressField(cameraX, cameraY);
      drawMemoryRibbon(cameraX, cameraY);
      connections.forEach((connection, index) => drawConnection(connection, index, focus));
      assemblyBlocks.forEach((block) => drawBlock(block, focus));
      drawing.restore();
      const shade = drawing.createLinearGradient(0, 0, width, 0);
      shade.addColorStop(0, "rgba(2, 7, 8, 0.84)");
      shade.addColorStop(mobile ? 0.4 : 0.32, "rgba(2, 7, 8, 0.55)");
      shade.addColorStop(0.7, "rgba(2, 7, 8, 0.03)");
      shade.addColorStop(1, "rgba(2, 7, 8, 0.18)");
      drawing.fillStyle = shade;
      drawing.fillRect(0, 0, width, height);
      const edge = drawing.createLinearGradient(0, 0, 0, height);
      edge.addColorStop(0, "rgba(2, 7, 8, 0.6)");
      edge.addColorStop(0.24, "rgba(2, 7, 8, 0)");
      edge.addColorStop(0.78, "rgba(2, 7, 8, 0)");
      edge.addColorStop(1, "rgba(2, 7, 8, 0.64)");
      drawing.fillStyle = edge;
      drawing.fillRect(0, 0, width, height);
    }

    function resize() {
      const bounds = host!.getBoundingClientRect();
      width = Math.round(bounds.width || window.innerWidth);
      height = Math.round(bounds.height || window.innerHeight);
      pixelRatio = Math.min(window.devicePixelRatio || 1, width < 760 ? 1.25 : 1.5);
      canvas!.width = Math.round(width * pixelRatio);
      canvas!.height = Math.round(height * pixelRatio);
      monoFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "monospace";
      makeBlockTextures();
      draw();
      host!.dataset.ready = "true";
    }

    function onFrame(event: Event) {
      frame = (event as CustomEvent<AssemblyFrame>).detail;
      draw();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    addEventListener("eto:motion-frame", onFrame);
    resize();
    document.fonts.ready.then(() => { if (!disposed) resize(); });
    return () => {
      disposed = true;
      observer.disconnect();
      removeEventListener("eto:motion-frame", onFrame);
      blockTextures.clear();
    };
  }, []);

  return (
    <div className="assembly-backdrop" ref={hostRef} aria-hidden="true">
      <canvas ref={canvasRef} data-assembly-canvas />
      <pre className="assembly-fallback">{`elf_header:
  cmp   dword [rdi], 0x464c457f
  jne   reject
  cmp   byte [rdi + 4], 2
  jne   reject

decode_byte:
  xor   byte [rdi], 0xc8
  inc   rdi
  dec   ecx
  jnz   decode_byte
  ret`}</pre>
    </div>
  );
}
