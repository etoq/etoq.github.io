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
  width: number;
  instructions: string[];
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
    id: "entry",
    label: "inspect_elf",
    address: 0x401000,
    x: 30,
    y: -240,
    width: 320,
    instructions: ["push  rbx", "mov   rbx, rdi", "test  rdi, rdi", "je    reject"],
  },
  {
    id: "header",
    label: "elf_header",
    address: 0x401010,
    x: 490,
    y: -100,
    width: 405,
    instructions: [
      "cmp   dword [rdi], 0x464c457f",
      "jne   reject",
      "cmp   byte [rdi + 4], 2",
      "jne   reject",
      "jmp   sections",
    ],
  },
  {
    id: "reject",
    label: "reject",
    address: 0x401030,
    x: -85,
    y: 360,
    width: 300,
    instructions: ["mov   eax, -1", "pop   rbx", "ret"],
  },
  {
    id: "sections",
    label: "sections",
    address: 0x401040,
    x: 1030,
    y: 140,
    width: 360,
    instructions: [
      "mov   rsi, [rbx + 0x28]",
      "add   rsi, rbx",
      "movzx ecx, word [rbx + 0x3c]",
      "jmp   strings",
    ],
  },
  {
    id: "strings",
    label: "strings",
    address: 0x401060,
    x: 720,
    y: 540,
    width: 355,
    instructions: [
      "lea   rdi, [rel encoded]",
      "mov   ecx, 3",
      "mov   r8b, 0xc8",
      "jmp   decode_byte",
    ],
  },
  {
    id: "decode",
    label: "decode_byte",
    address: 0x401078,
    x: 175,
    y: 785,
    width: 385,
    instructions: [
      "xor   byte [rdi], r8b",
      "inc   rdi",
      "dec   ecx",
      "jnz   decode_byte",
      "jmp   done",
    ],
  },
  {
    id: "done",
    label: "done",
    address: 0x401090,
    x: 795,
    y: 1075,
    width: 310,
    instructions: ["xor   eax, eax", "pop   rbx", "ret"],
  },
  {
    id: "data",
    label: "encoded",
    address: 0x404020,
    x: 1280,
    y: 775,
    width: 320,
    instructions: ["db    0xad, 0xbc, 0xa7", "; xor 0xc8", "; 65 74 6f  →  eto"],
  },
];
