export type Locale = "ru" | "en";

export type Project = {
  title: string;
  summary: string;
  contribution: string;
  result: string;
  technologies: string[];
  url: string;
};

export type Achievement = {
  title: string;
  date: string;
  role: string;
  result: string;
  url?: string;
};

export const publicData: {
  projects: Record<Locale, Project[]>;
  achievements: Record<Locale, Achievement[]>;
  githubUrl: string | null;
  email: string | null;
  telegramUrl: string | null;
  resumeUrl: string | null;
} = {
  projects: { ru: [], en: [] },
  achievements: { ru: [], en: [] },
  githubUrl: null,
  email: null,
  telegramUrl: null,
  resumeUrl: null,
};

export const content = {
  ru: {
    metadata: {
      title: "eto — Malware analysis & Linux reverse engineering",
      description: "Личное портфолио eto. Изучаю анализ вредоносного ПО, Linux и reverse engineering. Участвую в CTF.",
    },
    navigation: { about: "Обо мне", learning: "Направления", projects: "Проекты", achievements: "Достижения", contact: "Контакты" },
    skip: "Перейти к содержанию",
    language: "EN — Switch to English",
    intro: "Я eto. Учусь анализировать вредоносный код, разбирать Linux-программы и проверять свои выводы. Участвую в CTF.",
    decoded: "Декодированные байты",
    remaining: "байтов осталось",
    replay: "Повторить сцену",
    pause: "Пауза",
    resume: "Продолжить",
    motionDescription: "Три байта декодируются с помощью XOR в ник eto. Иллюстрация преобразования данных.",
    heroNote: "От байтов к поведению программы.",
    heroNoteBody: "Изучаю malware analysis с фокусом на Linux и reverse engineering.",
    about: {
      title: "Обо мне",
      paragraphs: [
        "Я eto, начинающий исследователь. Изучаю malware analysis и reverse engineering с фокусом на Linux, участвую в CTF.",
        "Разбираюсь, как инструкции, память и системные вызовы связаны с поведением программы. Учусь проверять предположения по коду и наблюдениям.",
      ],
      practice: "Самостоятельно использую команды Linux, знаю синтаксис Python и C. В учебных разборах пробовал Ghidra, strace и tcpdump, в том числе с подсказками.",
    },
    learning: {
      title: "Что изучаю",
      items: [
        { title: "Malware analysis", description: "Учусь понимать вредоносный код, преобразования данных и поведение программы." },
        { title: "Linux reverse engineering", description: "Разбираюсь в инструкциях, ELF, памяти, процессах и системных вызовах Linux." },
        { title: "CTF", description: "Участвую в соревнованиях и применяю знания к практическим задачам." },
      ],
      visualTitle: "Байты. Инструкции. Поведение.",
      visualDescription: "Два примера анализа — декодирование строки и наблюдение файловой операции.",
      file: "Формат файла",
      string: "Строка в памяти",
      execution: "Наблюдение за процессом",
      decodedString: "декодирование строки",
      separateExample: "Отдельный пример файлового ввода-вывода",
      fileNote: "Чтение конфигурации связывает файл, буфер и дальнейшую обработку данных.",
    },
    projects: "Проекты",
    achievements: "Достижения",
    contact: "Контакты",
    soon: "Скоро",
    contribution: "Мой вклад",
    result: "Результат",
    openProject: "Открыть проект",
    source: "Источник",
    contactLinks: { email: "Почта", telegram: "Telegram", resume: "Резюме" },
    top: "Наверх",
    notFound: "Страница не найдена",
  },
  en: {
    metadata: {
      title: "eto — Malware analysis & Linux reverse engineering",
      description: "eto’s personal portfolio. Learning malware analysis, Linux and reverse engineering, and taking part in CTFs.",
    },
    navigation: { about: "About", learning: "Focus", projects: "Projects", achievements: "Achievements", contact: "Contact" },
    skip: "Skip to content",
    language: "RU — Переключить на русский",
    intro: "I’m eto. I’m learning to analyze malware, reverse Linux programs and test my findings. I take part in CTFs.",
    decoded: "Decoded bytes",
    remaining: "bytes remaining",
    replay: "Replay scene",
    pause: "Pause",
    resume: "Resume",
    motionDescription: "Three bytes are XOR-decoded into the nickname eto. An illustration of data transformation.",
    heroNote: "From bytes to program behavior.",
    heroNoteBody: "Learning malware analysis with a focus on Linux and reverse engineering.",
    about: {
      title: "About me",
      paragraphs: [
        "I’m eto, an aspiring researcher. I’m learning malware analysis and reverse engineering with a focus on Linux, and I take part in CTFs.",
        "I’m exploring how instructions, memory and system calls relate to program behavior, and learning to test assumptions against code and observations.",
      ],
      practice: "I use Linux commands independently and know Python and C syntax. I’ve tried Ghidra, strace and tcpdump in learning exercises, sometimes with guidance.",
    },
    learning: {
      title: "What I’m learning",
      items: [
        { title: "Malware analysis", description: "Learning to understand malware, data transformations and program behavior." },
        { title: "Linux reverse engineering", description: "Exploring instructions, ELF, memory, processes and Linux system calls." },
        { title: "CTF", description: "Taking part in competitions and applying what I learn to practical challenges." },
      ],
      visualTitle: "Bytes. Instructions. Behavior.",
      visualDescription: "Two examples of analysis — string decoding and observing a file operation.",
      file: "File format",
      string: "A string in memory",
      execution: "Process observation",
      decodedString: "string decoding",
      separateExample: "A separate file I/O example",
      fileNote: "Reading a configuration connects a file, a buffer and subsequent data processing.",
    },
    projects: "Projects",
    achievements: "Achievements",
    contact: "Contact",
    soon: "Coming soon",
    contribution: "My contribution",
    result: "Result",
    openProject: "Open project",
    source: "Source",
    contactLinks: { email: "Email", telegram: "Telegram", resume: "Résumé" },
    top: "Back to top",
    notFound: "Page not found",
  },
};

export type PageContent = (typeof content)[Locale];
