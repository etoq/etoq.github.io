"use client";

import { useEffect, useRef } from "react";
import { assemblyBlocks, type AssemblyBlock, type AssemblyFrame } from "@/lib/assembly";

type Camera = {
  x: number;
  y: number;
  zoom: number;
  angle: number;
  focus: string;
};

const cameras: Camera[] = [
  { x: 590, y: 190, zoom: 0.85, angle: -0.075, focus: "header" },
  { x: 170, y: -45, zoom: 0.96, angle: -0.035, focus: "entry" },
  { x: 390, y: 825, zoom: 0.94, angle: 0.015, focus: "decode" },
  { x: 1090, y: 270, zoom: 0.9, angle: -0.065, focus: "sections" },
  { x: 905, y: 1085, zoom: 0.94, angle: -0.025, focus: "done" },
  { x: 1280, y: 805, zoom: 0.98, angle: 0.025, focus: "data" },
];

const branches = [
  { points: [[350, -145], [420, -145], [420, -20], [490, -20]], condition: "" },
  { points: [[895, 0], [960, 0], [960, 220], [1030, 220]], condition: "ELF64" },
  { points: [[490, 60], [65, 60], [65, 360]], condition: "jne" },
  { points: [[1210, 328], [1210, 470], [897, 470], [897, 540]], condition: "" },
  { points: [[720, 640], [635, 640], [635, 875], [560, 875]], condition: "" },
  { points: [[175, 945], [90, 945], [90, 825], [175, 825]], condition: "jnz" },
  { points: [[367, 1001], [367, 1160], [795, 1160]], condition: "ecx = 0" },
  { points: [[1280, 855], [1175, 855], [1175, 640], [1075, 640]], condition: "rip-relative" },
];

const initialFrame: AssemblyFrame = {
  scene: 0,
  progress: 0,
  time: 0,
  pointerX: 0,
  pointerY: 0,
  reduced: false,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function blockHeight(block: AssemblyBlock) {
  return 72 + block.instructions.length * 28;
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

    let frame = initialFrame;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let disposed = false;
    let monoFamily = "monospace";

    function drawGrid() {
      drawing.lineWidth = 0.7;
      drawing.strokeStyle = "rgba(75, 133, 126, 0.12)";
      drawing.beginPath();
      for (let x = -900; x <= 2500; x += 100) {
        drawing.moveTo(x, -1000);
        drawing.lineTo(x, 1900);
      }
      for (let y = -1000; y <= 1900; y += 100) {
        drawing.moveTo(-900, y);
        drawing.lineTo(2500, y);
      }
      drawing.stroke();

      drawing.strokeStyle = "rgba(83, 159, 148, 0.2)";
      drawing.beginPath();
      for (let x = -800; x <= 2400; x += 400) {
        for (let y = -800; y <= 1600; y += 400) {
          drawing.moveTo(x - 5, y);
          drawing.lineTo(x + 5, y);
          drawing.moveTo(x, y - 5);
          drawing.lineTo(x, y + 5);
        }
      }
      drawing.stroke();
    }

    function drawBranches() {
      drawing.font = `400 12px ${monoFamily}`;
      branches.forEach((branch, index) => {
        const points = branch.points;
        drawing.beginPath();
        drawing.moveTo(points[0][0], points[0][1]);
        points.slice(1).forEach(([x, y]) => drawing.lineTo(x, y));
        drawing.strokeStyle = index === 5 ? "rgba(108, 231, 214, 0.5)" : "rgba(41, 130, 119, 0.38)";
        drawing.lineWidth = index === 5 ? 1.4 : 1;
        drawing.stroke();

        drawing.setLineDash([8, 150]);
        drawing.lineDashOffset = frame.reduced ? 0 : -frame.time * 20 - index * 41;
        drawing.strokeStyle = "rgba(135, 247, 226, 0.68)";
        drawing.stroke();
        drawing.setLineDash([]);

        const last = points[points.length - 1];
        const previous = points[points.length - 2];
        const direction = Math.atan2(last[1] - previous[1], last[0] - previous[0]);
        drawing.save();
        drawing.translate(last[0], last[1]);
        drawing.rotate(direction);
        drawing.beginPath();
        drawing.moveTo(-8, -3);
        drawing.lineTo(0, 0);
        drawing.lineTo(-8, 3);
        drawing.stroke();
        drawing.restore();

        if (branch.condition) {
          drawing.fillStyle = "rgba(109, 175, 162, 0.7)";
          drawing.fillText(branch.condition, points[1][0] + 12, points[1][1] - 10);
        }
      });
    }

    function drawBlock(block: AssemblyBlock, focus: string) {
      const active = block.id === focus;
      const blockWidth = block.width;
      const blockHeightValue = blockHeight(block);
      drawing.save();
      drawing.translate(block.x, block.y);

      drawing.fillStyle = "rgba(1, 8, 10, 0.9)";
      drawing.fillRect(7, 9, blockWidth, blockHeightValue);
      drawing.strokeStyle = "rgba(22, 67, 62, 0.35)";
      drawing.strokeRect(7, 9, blockWidth, blockHeightValue);

      drawing.fillStyle = active ? "rgba(6, 25, 27, 0.93)" : "rgba(3, 15, 18, 0.92)";
      drawing.fillRect(0, 0, blockWidth, blockHeightValue);
      drawing.strokeStyle = active ? "rgba(82, 218, 200, 0.68)" : "rgba(48, 105, 96, 0.42)";
      drawing.lineWidth = active ? 1.3 : 1;
      drawing.strokeRect(0, 0, blockWidth, blockHeightValue);

      drawing.fillStyle = active ? "rgba(31, 104, 95, 0.2)" : "rgba(21, 58, 53, 0.18)";
      drawing.fillRect(0, 0, blockWidth, 39);
      drawing.strokeStyle = "rgba(54, 112, 101, 0.3)";
      drawing.beginPath();
      drawing.moveTo(0, 39);
      drawing.lineTo(blockWidth, 39);
      drawing.stroke();

      drawing.font = `500 15px ${monoFamily}`;
      drawing.fillStyle = active ? "#99e7db" : "#72a69c";
      drawing.fillText(`${block.label}:`, 18, 25);
      drawing.font = `400 10px ${monoFamily}`;
      drawing.fillStyle = "rgba(100, 154, 143, 0.58)";
      drawing.textAlign = "right";
      drawing.fillText(`0x${block.address.toString(16)}`, blockWidth - 15, 25);
      drawing.textAlign = "left";

      const lineIndex = frame.reduced ? 0 : Math.floor(frame.time / 0.58) % block.instructions.length;
      block.instructions.forEach((instruction, index) => {
        const baseline = 67 + index * 28;
        const current = active && index === lineIndex;
        if (current) {
          drawing.fillStyle = "rgba(10, 186, 181, 0.1)";
          drawing.fillRect(1, baseline - 19, blockWidth - 2, 27);
          drawing.fillStyle = "#84e7d6";
          drawing.fillRect(0, baseline - 19, 2, 27);
        }

        drawing.font = `400 10px ${monoFamily}`;
        drawing.fillStyle = current ? "#62b3a5" : "rgba(86, 132, 123, 0.5)";
        drawing.fillText((block.address + index * 3).toString(16).slice(-4), 14, baseline);

        const splitAt = instruction.indexOf(" ");
        const opcode = splitAt < 0 ? instruction : instruction.slice(0, splitAt);
        const operand = splitAt < 0 ? "" : instruction.slice(splitAt).trim();
        drawing.font = `400 14px ${monoFamily}`;
        drawing.fillStyle = current ? "#caf8eb" : active ? "#a2c9bd" : "#739b90";
        drawing.fillText(opcode, 58, baseline);
        drawing.fillStyle = current ? "#8ed5c5" : "#608b80";
        drawing.fillText(operand, 114, baseline);
      });

      if (active) {
        drawing.strokeStyle = "rgba(156, 245, 230, 0.8)";
        drawing.shadowColor = "rgba(10, 186, 181, 0.75)";
        drawing.shadowBlur = 10;
        drawing.beginPath();
        drawing.moveTo(0, 19);
        drawing.lineTo(0, 0);
        drawing.lineTo(23, 0);
        drawing.moveTo(blockWidth - 23, blockHeightValue);
        drawing.lineTo(blockWidth, blockHeightValue);
        drawing.lineTo(blockWidth, blockHeightValue - 19);
        drawing.stroke();
      }
      drawing.restore();
    }

    function draw() {
      if (disposed || !width || !height) return;
      const scene = frame.reduced ? 0 : clamp(frame.scene, 0, cameras.length - 1);
      const cameraIndex = Math.floor(scene);
      const next = cameras[Math.min(cameraIndex + 1, cameras.length - 1)];
      const current = cameras[cameraIndex];
      const fraction = scene - cameraIndex;
      const blend = fraction * fraction * (3 - 2 * fraction);
      const cameraX = current.x + (next.x - current.x) * blend;
      const cameraY = current.y + (next.y - current.y) * blend;
      const zoom = current.zoom + (next.zoom - current.zoom) * blend;
      const angle = current.angle + (next.angle - current.angle) * blend;
      const focus = blend < 0.5 ? current.focus : next.focus;
      const mobile = width < 760;
      const scale = (mobile ? 0.72 : clamp(width / 1600, 0.76, 1.2)) * zoom;
      const pointerX = frame.reduced ? 0 : frame.pointerX * 13;
      const pointerY = frame.reduced ? 0 : frame.pointerY * 9;

      drawing.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawing.fillStyle = "#020708";
      drawing.fillRect(0, 0, width, height);
      drawing.save();
      drawing.translate(width * (mobile ? 0.68 : 0.73) + pointerX, height * (mobile ? 0.67 : 0.53) + pointerY);
      drawing.rotate(angle);
      drawing.transform(1, -0.03, -0.085, 1, 0, 0);
      drawing.scale(scale, scale);
      drawing.translate(-cameraX, -cameraY);
      drawGrid();
      drawBranches();
      assemblyBlocks.forEach((block) => drawBlock(block, focus));
      drawing.restore();

      const horizontalShade = drawing.createLinearGradient(0, 0, width, 0);
      horizontalShade.addColorStop(0, "rgba(2, 7, 8, 0.82)");
      horizontalShade.addColorStop(mobile ? 0.45 : 0.32, "rgba(2, 7, 8, 0.52)");
      horizontalShade.addColorStop(0.75, "rgba(2, 7, 8, 0.08)");
      horizontalShade.addColorStop(1, "rgba(2, 7, 8, 0.28)");
      drawing.fillStyle = horizontalShade;
      drawing.fillRect(0, 0, width, height);

      const edgeShade = drawing.createLinearGradient(0, 0, 0, height);
      edgeShade.addColorStop(0, "rgba(2, 7, 8, 0.45)");
      edgeShade.addColorStop(0.25, "rgba(2, 7, 8, 0)");
      edgeShade.addColorStop(0.8, "rgba(2, 7, 8, 0)");
      edgeShade.addColorStop(1, "rgba(2, 7, 8, 0.68)");
      drawing.fillStyle = edgeShade;
      drawing.fillRect(0, 0, width, height);
    }

    function resize() {
      const bounds = host!.getBoundingClientRect();
      width = Math.round(bounds.width || window.innerWidth);
      height = Math.round(bounds.height || window.innerHeight);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas!.width = Math.round(width * pixelRatio);
      canvas!.height = Math.round(height * pixelRatio);
      monoFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "monospace";
      draw();
      host!.dataset.ready = "true";
    }

    function onFrame(event: Event) {
      frame = (event as CustomEvent<AssemblyFrame>).detail;
      draw();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    window.addEventListener("eto:motion-frame", onFrame);
    resize();
    document.fonts.ready.then(() => {
      if (!disposed) resize();
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.removeEventListener("eto:motion-frame", onFrame);
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
