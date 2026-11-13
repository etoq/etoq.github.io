"use client";

import { useCallback, useEffect, useState } from "react";
import { content, elfContent, publicData, type Locale } from "@/lib/content";
import { absoluteUrl, localPath } from "@/lib/config";
import type { GraphicsQuality } from "@/lib/elf";
import { SECTION_IDS, type SceneState } from "@/lib/scene-state";
import ElfBackdrop from "./ElfBackdrop";
import AnalysisConsole from "./AnalysisConsole";
import MotionController from "./MotionController";
import ProjectConsole from "./ProjectConsole";
import SignatureMark from "./SignatureMark";
import GraphicsControl from "./GraphicsControl";
import IntroSequence from "./IntroSequence";

const SAMPLE_LABELS = [".rodata", "sections", "trace", ".dynsym"];

export default function Portfolio({ locale: initialLocale }: { locale: Locale }) {
  const [locale, setLocale] = useState(initialLocale);
  const copy = content[locale];
  const sceneCopy = elfContent[locale];
  const [selected, setSelected] = useState([0, 0, 0, 0]);
  const [graphics, setGraphics] = useState<GraphicsQuality>("full");
  const titles = ["eto", copy.projects, copy.achievements, copy.contact];
  const intros = [sceneCopy.intro, sceneCopy.projectIntro, sceneCopy.achievementIntro, sceneCopy.contactIntro];
  const tabs = [["linux", "reverse", "ctf"], ["analyze.py", "notes.md", "rule.yar"], sceneCopy.achievementTabs, ["github", "mail", "telegram"]];
  const journal = sceneCopy.journal[selected[0]];
  const projects = publicData.projects[locale];
  const achievements = publicData.achievements[locale];
  const contacts = [
    { label: "GitHub", url: publicData.githubUrl },
    { label: copy.contactLinks.email, url: publicData.email ? `mailto:${publicData.email}` : null },
    { label: copy.contactLinks.telegram, url: publicData.telegramUrl },
    { label: copy.contactLinks.resume, url: publicData.resumeUrl },
  ].filter((contact) => contact.url);
  const empty = [false, projects.length === 0, achievements.length === 0, contacts.length === 0];

  const selectItem = useCallback((scene: number, item: number) => {
    setSelected((previous) => previous[scene] === item
      ? previous
      : previous.map((value, index) => index === scene ? item : value));
  }, []);
  const selectProject = useCallback((item: number) => selectItem(1, item), [selectItem]);
  const restoreState = useCallback((state: SceneState) => {
    setLocale(state.locale);
    setSelected(state.selected);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = content[locale].metadata.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", content[locale].metadata.description);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", content[locale].metadata.description);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", content[locale].metadata.description);
    document.querySelector('meta[property="og:locale"]')?.setAttribute("content", locale === "ru" ? "ru_RU" : "en_US");
    document.querySelector('meta[property="og:locale:alternate"]')?.setAttribute("content", locale === "ru" ? "en_US" : "ru_RU");
    const canonical = absoluteUrl(locale === "ru" ? "/" : "/en/");
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
    document.querySelector('meta[property="og:url"]')?.setAttribute("content", canonical);
  }, [locale]);

  return (
    <div id="portfolio" className="portfolio" data-locale={locale} data-graphics={graphics}>
      <IntroSequence />
      <a className="skip-link" href="#main">{copy.skip}</a>
      <span id="top" className="top-anchor" aria-hidden="true" />
      <div className="reading-progress" aria-hidden="true" />
      <header className="site-header">
        <a className="wordmark" href="#about" aria-label="eto">eto</a>
        <nav aria-label={locale === "ru" ? "Разделы сайта" : "Site sections"}>
          {SECTION_IDS.map((id) => <a key={id} href={`#${id}`} data-section-link>{copy.navigation[id]}</a>)}
        </nav>
        <div className="header-controls">
          <GraphicsControl locale={locale} onChange={setGraphics} />
          <a className="language-switch" href={localPath(locale === "ru" ? "/en/" : "/")} hrefLang={locale === "ru" ? "en" : "ru"} aria-label={copy.language} data-language-link>
            {locale === "ru" ? "EN" : "RU"}
          </a>
        </div>
      </header>

      <main id="main" className="story-track">
        {SECTION_IDS.map((id, scene) => (
          <section id={id} className={`story-scene ${id}-scene`} data-scene={scene} data-selected={selected[scene]} data-empty={empty[scene]} aria-labelledby={`${id}-title`} key={id}>
            <div className="scene-panel">
              <div className="scene-copy-window">
                <div className="scene-content">
                  {scene === 1 ? (
                    <ProjectConsole locale={locale} selected={selected[1]} onSelect={selectProject} projects={projects} />
                  ) : (
                    <>
                      <p className="elf-operation">{sceneCopy.operations[scene]}</p>
                      {scene === 0 ? <h1 id={`${id}-title`} className="scene-title identity-title"><span className="sr-only">eto</span><SignatureMark /></h1> : <h2 id={`${id}-title`} className="scene-title">{titles[scene]}</h2>}
                      <p className="scene-intro">{intros[scene]}</p>
                      <div className="elf-symbols" role="group" aria-label={sceneCopy.choose}>
                        {tabs[scene].map((label, item) => (
                          <button type="button" key={label} aria-pressed={selected[scene] === item} onClick={() => selectItem(scene, item)}>{label}</button>
                        ))}
                      </div>
                      <div className="elf-record" aria-live="polite">
                        {scene === 0 && <><h2>{journal.title}</h2><p>{journal.body}</p></>}
                        {scene === 2 && (achievements.length ? achievements.map((achievement) => (
                          <article className="achievement" key={achievement.title}>
                            <time dateTime={achievement.date}>{achievement.date}</time><h3>{achievement.title}</h3>
                            <p>{achievement.role}</p><p>{achievement.result}</p>
                            {achievement.url && <a href={achievement.url}>{copy.source}</a>}
                          </article>
                        )) : <p className="coming-soon">{copy.soon}</p>)}
                        {scene === 3 && (contacts.length ? <div className="contact-links">{contacts.map((contact) => <a key={contact.label} href={contact.url!}>{contact.label}</a>)}</div> : <p className="coming-soon">{copy.soon}</p>)}
                      </div>
                      {scene === 0 && (
                        <details className="focus-console" id="learning">
                          <summary>{sceneCopy.console}</summary>
                          <div aria-label={sceneCopy.consoleHint}><AnalysisConsole copy={copy} /></div>
                          <p className="practice-note">{copy.about.practice}</p>
                        </details>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        ))}
      </main>
      <ElfBackdrop locale={locale} onSelect={selectItem} />
      <footer className="site-footer">
        <span>{sceneCopy.sampleLabel}</span>
        <span className="sample-location" aria-hidden="true">eto.elf / <span data-sample-location>{SAMPLE_LABELS[0]}</span></span>
        <a href="#about">{copy.top}</a>
      </footer>
      <MotionController onRestore={restoreState} />
    </div>
  );
}
