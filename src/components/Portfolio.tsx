import { content, publicData, type Locale } from "@/lib/content";
import { localPath } from "@/lib/config";
import SignatureScene from "./SignatureScene";
import AnalysisVisual from "./AnalysisVisual";
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
      <div className="reading-progress" aria-hidden="true" />
      <header className="site-header" id="top">
        <a className="wordmark" href="#top" aria-label="eto">eto</a>
        <nav aria-label={locale === "ru" ? "Разделы сайта" : "Site sections"}>
          {Object.entries(copy.navigation).map(([id, label]) => <a key={id} href={`#${id}`} data-section-link>{label}</a>)}
        </nav>
        <a className="language-switch" href={localPath(locale === "ru" ? "/en/" : "/")} hrefLang={locale === "ru" ? "en" : "ru"} aria-label={copy.language} data-language-link>{locale === "ru" ? "EN" : "RU"}</a>
      </header>

      <main id="main">
        <SignatureScene copy={copy} />
        <div className="content-path">
          <div className="path-rail" aria-hidden="true"><span /></div>
          <section id="about" className="content-section about-section" data-observe-section data-reveal>
            <h2>{copy.about.title}</h2>
            <div className="section-body about-copy">
              {copy.about.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              <p className="practice-copy">{copy.about.practice}</p>
              <div className="about-annotation" aria-hidden="true"><span>Linux</span><span>ELF</span><span>x86-64</span></div>
            </div>
          </section>
          <section id="learning" className="learning-section" data-observe-section data-reveal>
            <div className="content-section learning-intro">
              <h2>{copy.learning.title}</h2>
              <div className="section-body learning-list">
                {copy.learning.items.map((item) => <div className="learning-item" key={item.title}><h3>{item.title}</h3><p>{item.description}</p></div>)}
              </div>
            </div>
            <AnalysisVisual copy={copy} />
          </section>
          <section id="projects" className="content-section empty-section projects-section" data-observe-section data-reveal>
            <h2>{copy.projects}</h2>
            <div className="section-body">
              {publicData.projects[locale].length ? publicData.projects[locale].map((project) => (
                <article className="project" key={project.title}>
                  <h3>{project.title}</h3><p>{project.summary}</p>
                  <p><span>{copy.contribution}</span> {project.contribution}</p>
                  <p><span>{copy.result}</span> {project.result}</p>
                  <p className="project-technologies">{project.technologies.join(" / ")}</p>
                  <a href={project.url}>{copy.openProject}</a>
                </article>
              )) : <p className="coming-soon"><span className="soon-line" aria-hidden="true" />{copy.soon}</p>}
            </div>
          </section>
          <section id="achievements" className="content-section empty-section achievements-section" data-observe-section data-reveal>
            <h2>{copy.achievements}</h2>
            <div className="section-body">
              {publicData.achievements[locale].length ? publicData.achievements[locale].map((achievement) => (
                <article className="achievement" key={achievement.title}>
                  <time dateTime={achievement.date}>{achievement.date}</time><h3>{achievement.title}</h3>
                  <p>{achievement.role}</p><p>{achievement.result}</p>
                  {achievement.url && <a href={achievement.url}>{copy.source}</a>}
                </article>
              )) : <p className="coming-soon"><span className="soon-line" aria-hidden="true" />{copy.soon}</p>}
            </div>
          </section>
          <section id="contact" className="content-section empty-section contact-section" data-observe-section data-reveal>
            <h2>{copy.contact}</h2>
            <div className="section-body">
              {contacts.length ? <div className="contact-links">{contacts.map((contact) => <a key={contact.label} href={contact.url!}>{contact.label}</a>)}</div> : <p className="coming-soon"><span className="soon-line" aria-hidden="true" />{copy.soon}</p>}
            </div>
          </section>
        </div>
      </main>
      <footer className="site-footer"><a className="wordmark" href="#top">eto</a><a href="#top">{copy.top}</a><span>{new Date().getFullYear()}</span></footer>
      <MotionController labels={{ pause: copy.pause, resume: copy.resume }} />
    </div>
  );
}
