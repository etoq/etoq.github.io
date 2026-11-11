import type { Locale, PageContent } from "@/lib/content";

const labels = {
  ru: {
    title: "Профиль исследователя",
    role: "Начинающий исследователь",
    focus: "Фокус",
    practice: "Практика",
    status: "Статус",
    learning: "Учусь",
  },
  en: {
    title: "Researcher profile",
    role: "Aspiring researcher",
    focus: "Focus",
    practice: "Practice",
    status: "Status",
    learning: "Learning",
  },
};

export default function ResearchProfile({
  copy,
  locale,
}: {
  copy: PageContent;
  locale: Locale;
}) {
  const text = labels[locale];

  return (
    <article className="research-profile" aria-label={text.title}>
      <div className="profile-bar" data-profile-item="header">
        <span>{text.title}</span>
        <span className="profile-file-name">eto</span>
      </div>

      <div className="profile-body">
        <div className="profile-identity" data-profile-item="identity">
          <h3>eto</h3>
          <p>{text.role}</p>
        </div>

        <dl className="profile-facts" data-profile-item="facts">
          <div>
            <dt>{text.focus}</dt>
            <dd>Malware analysis / Linux RE</dd>
          </div>
          <div>
            <dt>{text.practice}</dt>
            <dd>CTF</dd>
          </div>
          <div>
            <dt>{text.status}</dt>
            <dd className="profile-learning-state">{text.learning}</dd>
          </div>
        </dl>

        <div className="profile-summary">
          {copy.about.paragraphs.map((paragraph, index) => (
            <p key={paragraph} data-profile-item={`paragraph-${index}`}>
              {paragraph}
            </p>
          ))}
        </div>

        <p className="profile-note" data-profile-item="practice">
          {copy.about.practice}
        </p>
      </div>
    </article>
  );
}
