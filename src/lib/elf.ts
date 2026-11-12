export type GraphicsQuality = "full" | "lite";
export const ELF_INTRO_DURATION = 1800;
export const sceneCenterX = [0.68, 0.70, 0.72, 0.29] as const;
export const sceneCenterY = [0.48, 0.44, 0.58, 0.46] as const;

export type ElfFrame = {
  phase: number;
  time: number;
  pointerX: number;
  pointerY: number;
  reduced: boolean;
  selected: readonly number[];
  quality?: GraphicsQuality;
  velocity?: number;
  energy?: number;
  intro?: number;
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
