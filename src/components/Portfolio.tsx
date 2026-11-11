import { content, publicData, type Locale } from "@/lib/content";
import { localPath } from "@/lib/config";
import SignatureScene from "./SignatureScene";
import AssemblyBackdrop from "./AssemblyBackdrop";
import AnalysisConsole from "./AnalysisConsole";
import MotionController from "./MotionController";

export default function Portfolio({ locale }: { locale: Locale }) {
  const copy = content[locale];
  const contacts = [
    { label: "GitHub", url: publicData.githubUrl },
    { label: copy.contactLinks.email, url: publicData.email ? `mailto:${publicData.email}` : null },
    { label: copy.contactLinks.telegram, url: publicData.telegramUrl },
    { label: copy.contactLinks.resume, url: publicData.resumeUrl },
  ].filter((contact) => contact.url);

  return (
    <div id="portfolio" className="portfolio">
      <a className="skip-link" href="#main">{copy.skip}</a>
      <AssemblyBackdrop />
      <div className="viewport-frame" aria-hidden="true" />
      <div className="reading-progress" aria-hidden="true" />
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="eto">eto</a>
        <nav aria-label={locale === "ru" ? "Разделы сайта" : "Site sections"}>
          {Object.entries(copy.navigation).map(([id, label]) => (
            <a key={id} href={`#${id}`} data-section-link>{label}</a>
          ))}
        </nav>
        <a className="language-switch" href={localPath(locale === "ru" ? "/en/" : "/")} hrefLang={locale === "ru" ? "en" : "ru"} aria-label={copy.language} data-language-link>
          {locale === "ru" ? "EN" : "RU"}
        </a>
      </header>

      <main id="main" className="story-track">
        <SignatureScene copy={copy} />
        <section id="about" className="story-scene about-scene" data-scene="1" aria-labelledby="about-title">
          <div className="scene-panel">
            <div className="scene-content about-content">
              <h2 id="about-title">{copy.about.title}</h2>
              <div className="about-copy">
                {copy.about.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                <p className="practice-copy">{copy.about.practice}</p>
              </div>
            </div>
          </div>
        </section>
        <section id="learning" className="story-scene learning-scene" data-scene="2" aria-labelledby="learning-title">
          <div className="scene-panel">
            <div className="scene-content learning-content">
              <h2 id="learning-title">{copy.learning.title}</h2>
              <AnalysisConsole copy={copy} />
            </div>
          </div>
        </section>
        <section id="projects" className="story-scene projects-scene" data-scene="3" aria-labelledby="projects-title">
          <div className="scene-panel">
            <div className="scene-content collection-content">
              <h2 id="projects-title">{copy.projects}</h2>
              {publicData.projects[locale].length ? (
                <div className="project-list">
                  {publicData.projects[locale].map((project) => (
                    <article className="project" key={project.title}>
                      <h3>{project.title}</h3><p>{project.summary}</p>
                      <p><span>{copy.contribution}</span> {project.contribution}</p>
                      <p><span>{copy.result}</span> {project.result}</p>
                      <p className="project-technologies">{project.technologies.join(" / ")}</p>
                      <a href={project.url}>{copy.openProject}</a>
                    </article>
                  ))}
                </div>
              ) : <p className="coming-soon"><span aria-hidden="true" />{copy.soon}</p>}
            </div>
          </div>
        </section>
        <section id="achievements" className="story-scene achievements-scene" data-scene="4" aria-labelledby="achievements-title">
          <div className="scene-panel">
            <div className="scene-content collection-content">
              <h2 id="achievements-title">{copy.achievements}</h2>
              {publicData.achievements[locale].length ? (
                <div className="achievement-list">
                  {publicData.achievements[locale].map((achievement) => (
                    <article className="achievement" key={achievement.title}>
                      <time dateTime={achievement.date}>{achievement.date}</time><h3>{achievement.title}</h3>
                      <p>{achievement.role}</p><p>{achievement.result}</p>
                      {achievement.url && <a href={achievement.url}>{copy.source}</a>}
                    </article>
                  ))}
                </div>
              ) : <p className="coming-soon"><span aria-hidden="true" />{copy.soon}</p>}
            </div>
          </div>
        </section>
        <section id="contact" className="story-scene contact-scene" data-scene="5" aria-labelledby="contact-title">
          <div className="scene-panel">
            <div className="scene-content collection-content">
              <h2 id="contact-title">{copy.contact}</h2>
              {contacts.length ? <div className="contact-links">{contacts.map((contact) => <a key={contact.label} href={contact.url!}>{contact.label}</a>)}</div> : <p className="coming-soon"><span aria-hidden="true" />{copy.soon}</p>}
              <footer className="site-footer"><span>eto © {new Date().getFullYear()}</span><a href="#top">{copy.top}</a></footer>
            </div>
          </div>
        </section>
      </main>
      <div className="scene-hud" aria-hidden="true">
        <div className="hud-instruction"><span>rip</span><b data-hud-address>0x00401000</b><span data-hud-symbol>entry</span></div>
        <div className="hud-progress"><span data-hud-section>eto</span><span data-hud-progress>0%</span></div>
      </div>
      <MotionController />
    </div>
  );
}
