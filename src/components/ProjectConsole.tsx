"use client";

import { useEffect, useMemo, useRef } from "react";
import { content, type Locale, type Project } from "@/lib/content";
import { encodedBytes, elfInstructions, elfXrefs, elfYaraRule, getTraceState, scanElfSample, traceStepCount, type ElfLabState } from "@/lib/elf";
import "./research-console.css";

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
    command: "yara -s rule.yar eto.elf",
    lines: elfYaraRule.split("\n"),
  },
] as const;

function reveal(value: number) {
  const bounded = Math.max(0, Math.min(1, value));
  return bounded * bounded * (3 - 2 * bounded);
}

function hex(value: number, digits = 8) {
  return `0x${value.toString(16).padStart(digits, "0")}`;
}

export default function ProjectConsole({
  locale,
  selected,
  onSelect,
  projects,
  lab,
  onXref,
  onTraceStep,
  onYaraScan,
}: {
  locale: Locale;
  selected: number;
  onSelect: (item: number) => void;
  projects: Project[];
  lab: ElfLabState;
  onXref: (index: number) => void;
  onTraceStep: (step: number) => void;
  onYaraScan: () => void;
}) {
  const copy = content[locale];
  const russian = locale === "ru";
  const activeMaterial = materials[Math.max(0, Math.min(materials.length - 1, selected))];
  const trace = getTraceState(lab.traceStep);
  const activeXref = elfXrefs[Math.max(0, Math.min(elfXrefs.length - 1, lab.xref))];
  const scan = useMemo(() => lab.yaraPulse > 0 ? scanElfSample() : null, [lab.yaraPulse]);
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
        const delay = activeMaterial.lines.length > 1 ? index / (activeMaterial.lines.length - 1) * 0.38 : 0;
        line?.style.setProperty("--terminal-line-reveal", reveal((progress - 0.38 - delay) / 0.24).toFixed(4));
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
          {selected === 1 ? (
            <div className="lab-xrefs" role="group" aria-label={russian ? "Перекрёстные ссылки строк" : "String cross-references"}>
              {elfXrefs.map((xref, index) => (
                <button className="lab-xref" type="button" key={xref.name} data-xref-index={index} aria-pressed={lab.xref === index} onClick={() => onXref(index)}>
                  <span className="project-console-line lab-xref-row" ref={(element) => { lineRefs.current[index] = element; }}>
                    <span>{xref.name}</span><code>{hex(xref.address)}</code>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <pre className={`project-console-output${selected === 2 ? " lab-rule" : ""}`} aria-label={selected === 2 ? (russian ? "Правило YARA для eto.elf" : "YARA rule for eto.elf") : (russian ? "Фрагмент схемы ELF" : "ELF schematic excerpt")}>
              <code>{activeMaterial.lines.map((line, index) => (
                <span className="project-console-line" key={`${activeMaterial.section}-${index}`} ref={(element) => { lineRefs.current[index] = element; }}>{line || " "}</span>
              ))}</code>
            </pre>
          )}
        </div>
        {selected === 0 && (
          <div className="lab-trace" data-trace-step={trace.step}>
            <div className="lab-toolbar">
              <p>{russian ? "Пошагово" : "Single step"}<span className="lab-step-count">{trace.step} / {traceStepCount}</span></p>
              <div className="lab-controls">
                <button className="lab-step" type="button" disabled={trace.returned} onClick={() => onTraceStep(Math.min(traceStepCount, trace.step + 1))}>{russian ? "Шаг" : "Step"}</button>
                <button className="lab-reset" type="button" onClick={() => onTraceStep(-1)}>{russian ? "Сброс" : "Reset"}</button>
              </div>
            </div>
            <dl className="lab-registers" aria-label={russian ? "Регистры" : "Registers"}>
              <div><dt>RIP</dt><dd key={`rip-${trace.rip}`}>{trace.rip === null ? "ret" : hex(trace.rip)}</dd></div>
              <div><dt>RDI</dt><dd key={`rdi-${trace.rdi}`}>{hex(trace.rdi)}</dd></div>
              <div><dt>ECX</dt><dd key={`ecx-${trace.ecx}`}>{hex(trace.ecx)}</dd></div>
              <div><dt>ZF</dt><dd key={`zf-${trace.zf}`}>{Number(trace.zf)}</dd></div>
            </dl>
            <div className="lab-memory" aria-label={russian ? "Память по адресу 0x00403000" : "Memory at 0x00403000"}>
              <code className="lab-memory-address">0x00403000</code>
              <div className="lab-memory-bytes">
                {trace.memory.map((byte, index) => (
                  <span className="lab-byte" key={`${index}-${byte}`} data-decoded={byte !== encodedBytes[index]} data-pointer={trace.rdi === 0x403000 + index}>
                    <code>{byte.toString(16).padStart(2, "0")}</code><span>{byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : "·"}</span>
                  </span>
                ))}
              </div>
            </div>
            <p className="lab-trace-position" aria-live="polite">
              <span>{trace.lastRow === null ? (russian ? "Следующая" : "Next") : (russian ? "Выполнено" : "Executed")}</span>
              <code>{elfInstructions[trace.lastRow ?? trace.nextRow ?? 0].code}</code>
            </p>
          </div>
        )}
        {selected === 1 && (
          <div className="lab-reference" key={`xref-${lab.xrefPulse}`} aria-live="polite">
            <p className="lab-reference-addresses"><code>{hex(activeXref.address)}</code><span aria-hidden="true">←</span><code>{hex(activeXref.instructionAddress)}</code></p>
            <p className="lab-reference-instruction"><span>.text</span><code>{activeXref.instruction}</code></p>
          </div>
        )}
        {selected === 2 && (
          <div className="lab-yara" data-scan-state={scan ? (scan.matched ? "matched" : "clear") : "idle"}>
            <div className="lab-toolbar">
              <code>eto.elf</code>
              <button className="lab-scan" type="button" onClick={onYaraScan}>{russian ? "Проверить образец" : "Scan sample"}</button>
            </div>
            <div className="lab-scan-result" key={`scan-${lab.yaraPulse}`} role="status">
              {scan ? (
                <>
                  <p className="lab-match-title">{scan.matched ? scan.rule : (russian ? "Совпадений нет" : "No matches")}</p>
                  {scan.offsets.map((offset) => <p className="lab-match-offset" key={offset}><code>{hex(offset, 6)}</code><code>$encoded</code><code>{encodedBytes.map((byte) => byte.toString(16).padStart(2, "0")).join(" ")}</code></p>)}
                  {scan.matched && <p className="lab-match-count">{russian ? `Совпадений ${scan.offsets.length}` : `Matches ${scan.offsets.length}`}</p>}
                </>
              ) : <p className="lab-scan-idle">{russian ? "Встроенная проверка сигнатуры ELF и последовательности байтов." : "Built-in check of the ELF signature and byte sequence."}</p>}
            </div>
          </div>
        )}
        <noscript><p className="lab-script-note">{russian ? "Для взаимодействия с образцом нужен JavaScript." : "Sample interaction requires JavaScript."}</p></noscript>
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
