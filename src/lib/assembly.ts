export type AssemblyFrame = {
  scene: number;
  progress: number;
  time: number;
  pointerX: number;
  pointerY: number;
  reduced: boolean;
};

export type AssemblyBlock = {
  id: string;
  label: string;
  address: number;
  x: number;
  y: number;
  depth: number;
  width: number;
  instructions: string[];
  bytes: string[];
};

export const SCENE_SYMBOLS = [
  { address: "0x00401010", label: "elf_header" },
  { address: "0x00401000", label: "inspect_elf" },
  { address: "0x00401078", label: "decode_byte" },
  { address: "0x00401040", label: "sections" },
  { address: "0x00401090", label: "done" },
  { address: "0x00404020", label: "encoded" },
] as const;

export const assemblyBlocks: AssemblyBlock[] = [
  {
    id: "entry", label: "inspect_elf", address: 0x401000,
    x: 30, y: -240, depth: -24, width: 460,
    instructions: ["push  rbx", "mov   rbx, rdi", "test  rdi, rdi", "je    reject"],
    bytes: ["53", "48 89 fb", "48 85 ff", "74 27"],
  },
  {
    id: "header", label: "elf_header", address: 0x401010,
    x: 560, y: -85, depth: 45, width: 550,
    instructions: [
      "cmp   dword [rdi], 0x464c457f",
      "jne   reject",
      "cmp   byte [rdi + 4], 2",
      "jne   reject",
      "jmp   sections",
    ],
    bytes: ["81 3f 7f 45 4c 46", "75 18", "80 7f 04 02", "75 12", "eb 20"],
  },
  {
    id: "reject", label: "reject", address: 0x401030,
    x: -110, y: 390, depth: -58, width: 440,
    instructions: ["mov   eax, -1", "pop   rbx", "ret"],
    bytes: ["b8 ff ff ff ff", "5b", "c3"],
  },
  {
    id: "sections", label: "sections", address: 0x401040,
    x: 1190, y: 260, depth: 14, width: 540,
    instructions: [
      "mov   rsi, [rbx + 0x28]",
      "add   rsi, rbx",
      "movzx ecx, word [rbx + 0x3c]",
      "jmp   strings",
    ],
    bytes: ["48 8b 73 28", "48 01 de", "0f b7 4b 3c", "eb 13"],
  },
  {
    id: "strings", label: "strings", address: 0x401060,
    x: 780, y: 680, depth: -18, width: 515,
    instructions: [
      "lea   rdi, [rel encoded]",
      "mov   ecx, 3",
      "mov   r8b, 0xc8",
      "jmp   decode_byte",
    ],
    bytes: ["48 8d 3d b9 2f 00 00", "b9 03 00 00 00", "41 b0 c8", "eb 07"],
  },
  {
    id: "decode", label: "decode_byte", address: 0x401078,
    x: 165, y: 930, depth: 72, width: 500,
    instructions: [
      "xor   byte [rdi], r8b",
      "inc   rdi",
      "dec   ecx",
      "jnz   decode_byte",
      "jmp   done",
    ],
    bytes: ["44 30 07", "48 ff c7", "ff c9", "75 f6", "eb 0c"],
  },
  {
    id: "done", label: "done", address: 0x401090,
    x: 890, y: 1265, depth: 18, width: 420,
    instructions: ["xor   eax, eax", "pop   rbx", "ret"],
    bytes: ["31 c0", "5b", "c3"],
  },
  {
    id: "data", label: "encoded", address: 0x404020,
    x: 1480, y: 945, depth: 100, width: 440,
    instructions: ["db    0xad, 0xbc, 0xa7", "; xor 0xc8", "; 65 74 6f  →  eto"],
    bytes: ["ad bc a7", "", "65 74 6f"],
  },
];
