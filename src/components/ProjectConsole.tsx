"use client";

import { useEffect, useRef } from "react";
import { content, type Locale, type Project } from "@/lib/content";
import { elfInstructions } from "@/lib/elf";

const materials = [
  {
    file: "analyze.py",
    section: ".text",
    command: "objdump -d -j .text eto.elf",
    lines: [0, 1, 2, 5].map((index) => {
      const instruction = elfInstructions[index];
      return `${(0x401000 + instruction.offset).toString(16)}  ${instruction.code}`;
    }),
  },
  {
    file: "notes.md",
    section: ".rodata",
    command: "readelf -p .rodata eto.elf",
    lines: ["[     0]  linux", "[     6]  reverse", "[     e]  ctf"],
  },
  {
    file: "rule.yar",
    section: ".data",
    command: "readelf -x .data eto.elf",
    lines: ["0x00403000  ad bc a7", "", "XOR 0xc8   65 74 6f  \"eto\""],
  },
] as const;

function reveal(value: number) {
  const bounded = Math.max(0, Math.min(1, value));
  return bounded * bounded * (3 - 2 * bounded);
}

export default function ProjectConsole({
  locale,
  selected,
  onSelect,
  projects,
}: {
  locale: Locale;
  selected: number;
  onSelect: (item: number) => void;
  projects: Project[];
}) {
  const copy = content[locale];
  const activeMaterial = materials[Math.max(0, Math.min(materials.length - 1, selected))];
  const hostRef = useRef<HTMLElement>(null);
  const commandRef = useRef<HTMLSpanElement>(null);
  const lineRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const host = hostRef.current;
    const command = commandRef.current;
    const portfolio = document.getElementById("portfolio");
    if (!host || !command || !portfolio) return;
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | null = null;
    let startedAt: number | null = null;
    let active = false;
    let disposed = false;

    function stop() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      startedAt = null;
    }

    function complete() {
      stop();
      command!.textContent = activeMaterial.command;
      lineRefs.current.forEach((line) => line?.style.setProperty("--terminal-line-reveal", "1"));
      host!.dataset.terminalState = "complete";
    }

    function animate(timestamp: number) {
      frame = null;
      if (disposed || document.hidden || !active) return;
      if (startedAt === null) startedAt = timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / 1450);
      const typedLength = Math.floor(Math.min(1, progress / 0.46) * activeMaterial.command.length);
      command!.textContent = activeMaterial.command.slice(0, typedLength);
      lineRefs.current.forEach((line, index) => {
        line?.style.setProperty("--terminal-line-reveal", reveal((progress - 0.38 - index * 0.12) / 0.24).toFixed(4));
      });
      if (progress < 1) frame = requestAnimationFrame(animate);
      else complete();
    }

    function play() {
      stop();
      if (motionQuery.matches || document.hidden || !active) {
        complete();
        return;
      }
      host!.dataset.terminalState = "typing";
      command!.textContent = "";
      lineRefs.current.forEach((line) => line?.style.setProperty("--terminal-line-reveal", "0"));
      frame = requestAnimationFrame(animate);
    }

    function onSceneChange() {
      const next = portfolio!.dataset.activeSection === "projects";
      if (next === active) return;
      active = next;
      if (active) play();
      else complete();
    }

    function onVisibility() {
      if (document.hidden) complete();
      else if (active) play();
    }

    const observer = new MutationObserver(onSceneChange);
    observer.observe(portfolio, { attributes: true, attributeFilter: ["data-active-section"] });
    motionQuery.addEventListener("change", play);
    document.addEventListener("visibilitychange", onVisibility);
    onSceneChange();

    return () => {
      disposed = true;
      stop();
      observer.disconnect();
      motionQuery.removeEventListener("change", play);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeMaterial]);

  return (
    <article className="project-console" ref={hostRef} aria-label={copy.projects}>
      <header className="project-console-header">
        <h2 id="projects-title" className="project-console-identity">eto@lab <span>~/projects</span></h2>
        <span className="project-console-caption">{locale === "ru" ? "Схема eto.elf" : "Schematic eto.elf"}</span>
      </header>
      <div className="project-console-body">
        <div className="elf-symbols project-console-materials" role="group" aria-label={locale === "ru" ? "Материалы исследования" : "Research materials"}>
          {materials.map((material, index) => (
            <button type="button" key={material.file} aria-pressed={selected === index} onClick={() => onSelect(index)}>
              {material.file}
            </button>
          ))}
        </div>
        <p className="project-console-command">
          <span className="project-console-prompt" aria-hidden="true">$</span>
          <span className="sr-only">{activeMaterial.command}</span>
          <span className="project-console-command-text" ref={commandRef} aria-hidden="true">{activeMaterial.command}</span>
          <span className="project-console-caret" aria-hidden="true" />
        </p>
        <div className="project-console-surface">
          <span className="project-console-section" aria-live="polite">{activeMaterial.section}</span>
          <pre className="project-console-output" aria-label={locale === "ru" ? "Фрагмент схемы ELF" : "ELF schematic excerpt"}>
            <code>{activeMaterial.lines.map((line, index) => (
              <span className="project-console-line" key={`${activeMaterial.section}-${index}`} ref={(element) => { lineRefs.current[index] = element; }}>{line || " "}</span>
            ))}</code>
          </pre>
        </div>
        <div className="project-console-projects">
          <p className="project-console-directory">./projects</p>
          {projects.length ? projects.map((project) => (
            <article className="project" key={project.title}>
              <h3>{project.title}</h3>
              <p>{project.summary}</p>
              <p><span>{copy.contribution}</span> {project.contribution}</p>
              <p><span>{copy.result}</span> {project.result}</p>
              <p className="project-technologies">{project.technologies.join(" / ")}</p>
              <a href={project.url}>{copy.openProject}</a>
            </article>
          )) : <p className="coming-soon project-console-empty">{copy.soon}</p>}
        </div>
      </div>
    </article>
  );
}
