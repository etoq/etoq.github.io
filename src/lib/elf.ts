export type GraphicsQuality = "full" | "lite";

export type ElfLabState = {
  xref: number;
  xrefPulse: number;
  traceStep: number;
  yaraPulse: number;
};

export const initialLabState: ElfLabState = { xref: 0, xrefPulse: 0, traceStep: -1, yaraPulse: 0 };

export type ElfFrame = {
  phase: number;
  time: number;
  pointerX: number;
  pointerY: number;
  reduced: boolean;
  selected: readonly number[];
  quality?: GraphicsQuality;
  lab?: ElfLabState;
};

export const ELF_FRAME_EVENT = "eto:elf-frame";

export const elfInstructions = [
  { offset: 0, bytes: "48 8d 3d f9 1f 00 00", code: "lea rdi, [rel data]" },
  { offset: 7, bytes: "b9 03 00 00 00", code: "mov ecx, 3" },
  { offset: 12, bytes: "80 37 c8", code: "xor byte [rdi], 0xc8" },
  { offset: 15, bytes: "48 ff c7", code: "inc rdi" },
  { offset: 18, bytes: "ff c9", code: "dec ecx" },
  { offset: 20, bytes: "75 f6", code: "jnz decode" },
  { offset: 22, bytes: "c3", code: "ret" },
] as const;

export const traceSequence = [0, 1, 2, 3, 4, 5, 2, 3, 4, 5, 2, 3, 4, 5, 6] as const;
export const traceStepCount = traceSequence.length;
export const encodedBytes = [0xad, 0xbc, 0xa7] as const;

export const elfXrefs = [
  { name: "linux", offset: 0 },
  { name: "reverse", offset: 6 },
  { name: "ctf", offset: 14 },
].map(({ name, offset }, index) => {
  const address = 0x402000 + offset;
  const instructionAddress = 0x401020 + index * 7;
  const instructionBytes = new Uint8Array(7);
  instructionBytes.set([0x48, 0x8d, 0x35]);
  new DataView(instructionBytes.buffer).setInt32(3, address - instructionAddress - 7, true);
  return {
    name, address, instructionAddress,
    instruction: `lea rsi, [rel ${name}]`,
    bytes: Array.from(instructionBytes, (byte) => byte.toString(16).padStart(2, "0")).join(" "),
  };
});

export function getTraceState(requestedStep: number) {
  const step = Number.isFinite(requestedStep) ? Math.max(0, Math.min(traceStepCount, Math.trunc(requestedStep))) : 0;
  const memory: number[] = [...encodedBytes];
  let rdi = 0;
  let ecx = 0;
  let zf = false;
  for (let index = 0; index < step; index++) {
    switch (traceSequence[index]) {
      case 0: rdi = 0x403000; break;
      case 1: ecx = 3; break;
      case 2:
        memory[rdi - 0x403000] ^= 0xc8;
        zf = memory[rdi - 0x403000] === 0;
        break;
      case 3: rdi++; zf = rdi === 0; break;
      case 4: ecx = (ecx - 1) >>> 0; zf = ecx === 0; break;
    }
  }
  const nextRow = step < traceStepCount ? traceSequence[step] : null;
  return {
    step, rdi, ecx, zf, memory,
    rip: nextRow === null ? null : 0x401000 + elfInstructions[nextRow].offset,
    nextRow,
    lastRow: step > 0 ? traceSequence[step - 1] : null,
    returned: step === traceStepCount,
  };
}

export const elfYaraRule = `rule eto_xor_marker {
  strings:
    $encoded = { AD BC A7 }
  condition:
    uint32(0) == 0x464c457f and $encoded
}`;

function createSampleBytes() {
  const bytes = new Uint8Array(0x3000 + encodedBytes.length);
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1], 0);
  elfInstructions.forEach((instruction) => bytes.set(instruction.bytes.split(" ").map((byte) => parseInt(byte, 16)), 0x1000 + instruction.offset));
  elfXrefs.forEach((xref) => bytes.set(xref.bytes.split(" ").map((byte) => parseInt(byte, 16)), xref.instructionAddress - 0x400000));
  bytes.set(new TextEncoder().encode("linux\0reverse\0ctf\0"), 0x2000);
  bytes.set(encodedBytes, 0x3000);
  return bytes;
}

export const elfSampleBytes = createSampleBytes();

export function scanElfSample(bytes: Uint8Array = elfSampleBytes) {
  const offsets: number[] = [];
  const hasElfMagic = bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46;
  if (hasElfMagic) {
    for (let offset = 0; offset <= bytes.length - encodedBytes.length; offset++) {
      if (encodedBytes.every((byte, index) => bytes[offset + index] === byte)) offsets.push(offset);
    }
  }
  return { rule: "eto_xor_marker", matched: offsets.length > 0, offsets };
}
