import { elfInstructions, sceneCenterX, sceneCenterY, type ElfFrame } from "./elf";

type Instruction = { code: string; bytes: string; target?: string };
type Listing = {
  id: string;
  label: string;
  address: number;
  x: number;
  y: number;
  depth: number;
  width: number;
  instructions: readonly Instruction[];
};
type Connection = { from: string; to: string; bend: number; label?: string };
type WorldFocus = { block: string; zoom: number; angle: number; arc: number };
export type AssemblyWorldView = { focusX: number; focusY: number; arrival: number; cameraZoom: number };

const listings: Listing[] = [
  {
    id: "entry", label: "inspect_elf", address: 0x402000,
    x: 30, y: -240, depth: -24, width: 460,
    instructions: [
      { code: "push rbx", bytes: "53" },
      { code: "mov rbx, rdi", bytes: "48 89 fb" },
      { code: "test rdi, rdi", bytes: "48 85 ff" },
      { code: "je reject", bytes: "0f 84", target: "reject" },
      { code: "jmp elf_header", bytes: "e9", target: "header" },
    ],
  },
  {
    id: "header", label: "elf_header", address: 0x402020,
    x: 560, y: -85, depth: 45, width: 550,
    instructions: [
      { code: "cmp dword [rbx], 0x464c457f", bytes: "81 3b 7f 45 4c 46" },
      { code: "jne reject", bytes: "0f 85", target: "reject" },
      { code: "cmp byte [rbx + 4], 2", bytes: "80 7b 04 02" },
      { code: "jne reject", bytes: "0f 85", target: "reject" },
      { code: "jmp sections", bytes: "e9", target: "sections" },
    ],
  },
  {
    id: "reject", label: "reject", address: 0x402050,
    x: -110, y: 390, depth: -58, width: 440,
    instructions: [
      { code: "mov eax, -1", bytes: "b8 ff ff ff ff" },
      { code: "pop rbx", bytes: "5b" },
      { code: "ret", bytes: "c3" },
    ],
  },
  {
    id: "sections", label: "sections", address: 0x402080,
    x: 1190, y: 260, depth: 14, width: 540,
    instructions: [
      { code: "mov rsi, [rbx + 0x28]", bytes: "48 8b 73 28" },
      { code: "add rsi, rbx", bytes: "48 01 de" },
      { code: "movzx ecx, word [rbx + 0x3c]", bytes: "0f b7 4b 3c" },
      { code: "jmp strings", bytes: "e9", target: "strings" },
    ],
  },
  {
    id: "strings", label: "strings", address: 0x4020a0,
    x: 780, y: 680, depth: -18, width: 515,
    instructions: [
      { code: "lea rdi, [rel encoded]", bytes: "48 8d 3d 59 0f 00 00" },
      { code: "mov ecx, 3", bytes: "b9 03 00 00 00" },
      { code: "mov r8b, 0xc8", bytes: "41 b0 c8" },
      { code: "call decode_sample", bytes: "e8", target: "decode" },
      { code: "jmp done", bytes: "e9", target: "done" },
    ],
  },
  {
    id: "decode", label: "decode_sample", address: 0x401000,
    x: 165, y: 930, depth: 72, width: 580,
    instructions: elfInstructions.map((instruction) => ({ code: instruction.code, bytes: instruction.bytes })),
  },
  {
    id: "done", label: "done", address: 0x4020d0,
    x: 890, y: 1265, depth: 18, width: 420,
    instructions: [
      { code: "xor eax, eax", bytes: "31 c0" },
      { code: "pop rbx", bytes: "5b" },
      { code: "ret", bytes: "c3" },
    ],
  },
  {
    id: "data", label: "encoded", address: 0x403000,
    x: 1480, y: 945, depth: 100, width: 440,
    instructions: [
      { code: "db 0xad, 0xbc, 0xa7", bytes: "ad bc a7" },
      { code: "; xor 0xc8", bytes: "" },
      { code: "; 65 74 6f   eto", bytes: "65 74 6f" },
    ],
  },
];

const connections: Connection[] = [
  { from: "entry", to: "header", bend: 0.25 },
  { from: "header", to: "sections", bend: 0.45, label: "ELF64" },
  { from: "header", to: "reject", bend: -0.7, label: "jne" },
  { from: "sections", to: "strings", bend: 0.35 },
  { from: "strings", to: "decode", bend: -0.25, label: "call" },
  { from: "decode", to: "decode", bend: -1, label: "jnz" },
  { from: "strings", to: "done", bend: 0.45, label: "jmp" },
  { from: "strings", to: "data", bend: 0.4, label: "rip-relative" },
];

const foci: WorldFocus[] = [
  { block: "header", zoom: 0.95, angle: -0.12, arc: -260 },
  { block: "sections", zoom: 0.92, angle: -0.07, arc: 320 },
  { block: "decode", zoom: 0.98, angle: 0.035, arc: -250 },
  { block: "data", zoom: 1.02, angle: 0.045, arc: 0 },
];

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
function listingHeight(listing: Listing) {
  return 62 + listing.instructions.length * 33;
}
function relativeBytes(prefix: string, address: number, target: number) {
  const instructionLength = prefix.split(" ").length + 4;
  const displacement = (target - address - instructionLength) >>> 0;
  const bytes = [0, 8, 16, 24].map((shift) => ((displacement >>> shift) & 0xff).toString(16).padStart(2, "0"));
  return `${prefix} ${bytes.join(" ")}`;
}

export function createAssemblyWorld() {
  const byId = new Map(listings.map((listing) => [listing.id, listing]));
  const textures = new Map<string, HTMLCanvasElement>();
  let fontFamily = "monospace";
  let pixelRatio = 1;
  const grid = new Path2D();
  const crosses = new Path2D();
  for (let x = -1800; x <= 3600; x += 100) {
    grid.moveTo(x, -1800);
    grid.lineTo(x, 2800);
  }
  for (let y = -1800; y <= 2800; y += 100) {
    grid.moveTo(-1800, y);
    grid.lineTo(3600, y);
  }
  for (let x = -1600; x <= 3600; x += 400) {
    for (let y = -1600; y <= 2800; y += 400) {
      crosses.moveTo(x - 4, y);
      crosses.lineTo(x + 4, y);
      crosses.moveTo(x, y - 4);
      crosses.lineTo(x, y + 4);
    }
  }

  function rebuild(family: string, ratio: number) {
    fontFamily = family;
    pixelRatio = ratio;
    textures.clear();
    listings.forEach((listing) => {
      const texture = document.createElement("canvas");
      texture.width = Math.ceil((listing.width + 32) * pixelRatio);
      texture.height = Math.ceil((listingHeight(listing) + 26) * pixelRatio);
      const ink = texture.getContext("2d");
      if (!ink) return;
      ink.scale(pixelRatio, pixelRatio);
      ink.translate(10, 10);
      const surface = ink.createLinearGradient(0, 0, listing.width, listingHeight(listing));
      surface.addColorStop(0, "#071b1ae8");
      surface.addColorStop(0.75, "#03100fb0");
      surface.addColorStop(1, "#03100f08");
      ink.fillStyle = surface;
      ink.fillRect(0, 0, listing.width, listingHeight(listing));
      ink.strokeStyle = "#579d8b8c";
      ink.lineWidth = 1;
      ink.beginPath();
      ink.moveTo(0, listingHeight(listing));
      ink.lineTo(0, 0);
      ink.lineTo(listing.width, 0);
      ink.stroke();
      ink.strokeStyle = "#387d6d47";
      ink.beginPath();
      ink.moveTo(72, 39);
      ink.lineTo(72, listingHeight(listing) - 12);
      ink.moveTo(0, 39);
      ink.lineTo(listing.width, 39);
      ink.stroke();
      ink.font = `500 15px ${fontFamily}`;
      ink.fillStyle = "#91d6c4";
      ink.fillText(`${listing.label}:`, 16, 25);
      ink.font = `400 10px ${fontFamily}`;
      ink.fillStyle = "#7caf9b";
      ink.textAlign = "right";
      ink.fillText(`0x${listing.address.toString(16)}`, listing.width - 12, 24);
      ink.textAlign = "left";
      let address = listing.address;
      listing.instructions.forEach((instruction, index) => {
        const target = instruction.target ? byId.get(instruction.target) : null;
        const bytes = target ? relativeBytes(instruction.bytes, address, target.address) : instruction.bytes;
        const baseline = 65 + index * 33;
        ink.font = `400 10px ${fontFamily}`;
        ink.fillStyle = "#69a18d";
        ink.fillText(address.toString(16).slice(-4), 14, baseline);
        ink.font = `400 9px ${fontFamily}`;
        ink.fillStyle = "#619d8a";
        ink.fillText(bytes, 86, baseline);
        const split = instruction.code.indexOf(" ");
        const mnemonic = split < 0 ? instruction.code : instruction.code.slice(0, split);
        const operand = split < 0 ? "" : instruction.code.slice(split).trim();
        ink.font = `400 14px ${fontFamily}`;
        ink.fillStyle = "#b4dcd0";
        ink.fillText(mnemonic, 224, baseline);
        ink.fillStyle = "#83b8a4";
        ink.fillText(operand, 278, baseline);
        address += bytes ? bytes.split(" ").length : 0;
      });
      textures.set(listing.id, texture);
    });
  }

  function drawAddressField(context: CanvasRenderingContext2D, cameraX: number, cameraY: number, lite: boolean) {
    context.save();
    context.translate(cameraX * 0.14, cameraY * 0.12 - 180);
    context.scale(1.08, 0.92);
    context.lineWidth = 0.7;
    context.strokeStyle = "#295d541f";
    context.stroke(grid);
    if (lite) { context.restore(); return; }
    context.strokeStyle = "#4e99824d";
    context.stroke(crosses);
    context.font = `400 10px ${fontFamily}`;
    for (let rail = -1; rail < 5; rail++) {
      const x = rail * 950 - 550;
      context.strokeStyle = "#4a9b802c";
      context.beginPath();
      context.moveTo(x, -1500);
      context.lineTo(x, 2600);
      context.stroke();
      for (let row = 0; row < 32; row++) {
        const y = row * 120 - 1300;
        context.fillStyle = row % 4 === 0 ? "#53a38b73" : "#3f786a45";
        context.fillText((0x401000 + row * 0x20 + (rail + 1) * 0x1000).toString(16).padStart(8, "0"), x + 12, y);
        context.fillRect(x - 4, y - 4, 8, 1);
      }
    }
    context.restore();
  }

  function focusWeight(id: string, phase: number) {
    return foci.reduce((weight, focus, index) => focus.block === id ? weight + smooth(1 - Math.abs(phase - index)) : weight, 0);
  }

  function drawConnection(context: CanvasRenderingContext2D, connection: Connection, index: number, frame: ElfFrame) {
    const from = byId.get(connection.from)!;
    const to = byId.get(connection.to)!;
    const active = Math.max(focusWeight(from.id, frame.phase), focusWeight(to.id, frame.phase));
    if (frame.quality === "lite" && active <= 0.01) return;
    const loop = from === to;
    const startX = loop ? from.x : from.x + from.width * 0.7;
    const startY = from.y + listingHeight(from) - 8;
    const endX = loop ? to.x : to.x + 20;
    const endY = loop ? to.y + 78 : to.y;
    const controlX = loop ? startX - 140 : (startX + endX) / 2 + connection.bend * 220;
    context.beginPath();
    context.moveTo(startX, startY);
    context.bezierCurveTo(controlX, startY + 110, controlX, endY - 110, endX, endY);
    context.lineWidth = mix(0.8, 1.4, active);
    const energy = frame.reduced ? 0 : (frame.energy ?? 0) * (frame.quality === "lite" ? 0.4 : 1);
    context.strokeStyle = `rgba(55, 187, 164, ${mix(0.28, 0.68, active) + energy * 0.15})`;
    context.stroke();
    context.setLineDash([mix(8, 24, active), 280]);
    context.lineDashOffset = frame.reduced ? 0 : -frame.time * mix(20, 42, active) - index * 53;
    context.strokeStyle = `rgba(173, 255, 228, ${mix(0.3, 0.9, active)})`;
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = active > 0.4 ? "#9cf5df" : "#377e6c";
    context.fillRect(endX - 2, endY - 2, 4, 4);
    if (connection.label) {
      context.font = `400 10px ${fontFamily}`;
      context.fillStyle = active > 0.4 ? "#78bfa7" : "#417d6c";
      context.fillText(connection.label, controlX + 12, (startY + endY) / 2);
    }
  }

  function drawListing(context: CanvasRenderingContext2D, listing: Listing, frame: ElfFrame, arrival: number) {
    const texture = textures.get(listing.id);
    if (!texture) return;
    const active = focusWeight(listing.id, frame.phase);
    if (frame.quality === "lite" && active <= 0.01) return;
    const depthX = frame.reduced ? 0 : frame.pointerX * listing.depth * 0.13;
    const depthY = frame.reduced ? 0 : frame.pointerY * listing.depth * 0.075;
    context.save();
    context.translate(listing.x + depthX, listing.y + depthY);
    context.transform(1, -listing.depth * 0.00032, -0.035, 1, 0, 0);
    context.globalAlpha *= mix(0.66, 0.88 - arrival * 0.25, active);
    context.drawImage(texture, -10, -10, texture.width / pixelRatio, texture.height / pixelRatio);
    if (active > 0.01) {
      const row = frame.reduced ? 0 : Math.floor(frame.time / 0.58) % listing.instructions.length;
      const baseline = 65 + row * 33;
      const light = context.createLinearGradient(0, 0, listing.width, 0);
      light.addColorStop(0, `rgba(10, 186, 181, ${active * 0.24})`);
      light.addColorStop(1, "#0abab500");
      context.fillStyle = light;
      context.fillRect(0, baseline - 22, listing.width, 32);
      context.fillStyle = `rgba(156, 245, 230, ${active})`;
      context.fillRect(0, baseline - 21, 2, 30);
      context.beginPath();
      context.moveTo(-13, baseline - 10);
      context.lineTo(-7, baseline - 6);
      context.lineTo(-13, baseline - 2);
      context.fill();
    }
    context.restore();
  }

  function drawMemoryRibbon(context: CanvasRenderingContext2D, cameraX: number, cameraY: number, frame: ElfFrame) {
    context.save();
    context.translate(580 - cameraX * 0.045, 1445 - cameraY * 0.035);
    context.transform(1, -0.14, 0.3, 0.7, 0, 0);
    const byteValues = ["7f", "45", "4c", "46", "02", "01", "01", "00", "ad", "bc", "a7", "00", "65", "74", "6f", "00"];
    context.font = `400 19px ${fontFamily}`;
    const selected = frame.reduced ? 8 : 8 + Math.floor(frame.time / 0.72) % 3;
    byteValues.forEach((byte, index) => {
      const x = index * 48;
      context.fillStyle = index === selected ? "#0abab529" : "#03101280";
      context.fillRect(x, -28, 40, 49);
      context.fillStyle = index === selected ? "#a6f7df" : "#438b78";
      context.fillText(byte, x + 7, 2);
      context.fillStyle = index === selected ? "#0abab5" : "#225542";
      context.fillRect(x, 20, 40, 1);
    });
    context.font = `400 10px ${fontFamily}`;
    context.fillStyle = "#3f7e6b";
    context.fillText(".data  0x00403000", 0, -47);
    context.restore();
  }

  function draw(context: CanvasRenderingContext2D, width: number, height: number, frame: ElfFrame): AssemblyWorldView {
    const phase = clamp(frame.phase, 0, 3);
    const index = Math.min(2, Math.floor(phase));
    const fraction = phase - index;
    const blend = smooth(fraction);
    const current = foci[index];
    const next = foci[index + 1];
    const from = byId.get(current.block)!;
    const to = byId.get(next.block)!;
    const focusX = mix(from.x + from.width / 2, to.x + to.width / 2, blend);
    const focusY = mix(from.y + listingHeight(from) / 2, to.y + listingHeight(to) / 2, blend);
    const travel = 4 * blend * (1 - blend);
    const arrival = 1 - 0.9 * travel;
    const energy = frame.reduced ? 0 : (frame.energy ?? 0) * (frame.quality === "lite" ? 0.4 : 1);
    const velocity = frame.reduced ? 0 : (frame.velocity ?? 0) * (frame.quality === "lite" ? 0.4 : 1);
    const entrance = smooth(((frame.intro ?? 1) - 0.12) / 0.88);
    const cameraX = focusX + travel * current.arc + velocity * 55;
    const cameraY = focusY - travel * 180 + energy * 22;
    const cameraZoom = mix(current.zoom, next.zoom, blend) * (1 - travel * 0.36) * (1 - energy * 0.1) * (0.62 + entrance * 0.38);
    const angle = mix(current.angle, next.angle, blend) + Math.sin(blend * Math.PI * 2) * 0.035 + velocity * 0.018;
    const mobile = width < 760;
    const scale = (mobile ? clamp(width / 680, 0.43, 0.78) : clamp(width / 1600, 0.72, 1.16)) * cameraZoom;
    const pointerX = frame.reduced ? 0 : frame.pointerX * 16;
    const pointerY = frame.reduced ? 0 : frame.pointerY * 10;
    const originX = width * (mobile ? 0.5 : mix(sceneCenterX[index], sceneCenterX[index + 1], blend)) + pointerX;
    const originY = height * (mobile ? 0.26 : mix(sceneCenterY[index], sceneCenterY[index + 1], blend)) + pointerY;
    context.save();
    context.globalAlpha *= 0.22 + entrance * 0.78;
    context.translate(originX, originY);
    context.rotate(angle);
    context.transform(1, -0.065, -0.12, 1, 0, 0);
    context.scale(scale, scale);
    context.translate(-cameraX, -cameraY);
    drawAddressField(context, cameraX, cameraY, frame.quality === "lite");
    if (frame.quality !== "lite" || phase > 2.3) drawMemoryRibbon(context, cameraX, cameraY, frame);
    connections.forEach((connection, connectionIndex) => drawConnection(context, connection, connectionIndex, frame));
    listings.forEach((listing) => drawListing(context, listing, frame, arrival));
    context.restore();
    const x = (focusX - cameraX) * scale;
    const y = (focusY - cameraY) * scale;
    const skewX = x - 0.12 * y;
    const skewY = y - 0.065 * x;
    return {
      focusX: originX + skewX * Math.cos(angle) - skewY * Math.sin(angle),
      focusY: originY + skewX * Math.sin(angle) + skewY * Math.cos(angle),
      arrival,
      cameraZoom,
    };
  }

  return { rebuild, draw, dispose: () => textures.clear() };
}
