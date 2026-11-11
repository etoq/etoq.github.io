import type { CSSProperties } from "react";
import type { PageContent } from "@/lib/content";

export default function AnalysisConsole({ copy }: { copy: PageContent }) {
  const command = "ls ./focus";

  return (
    <div className="analysis-console">
      <div className="console-titlebar">
        <span className="console-window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>eto@lab</span>
      </div>

      <div className="console-body">
        <p className="console-command">
          <span className="console-prompt" aria-hidden="true">&gt;</span>{" "}
          <span className="sr-only">{command}</span>
          <span data-console-command data-command={command} aria-hidden="true">
            {command}
          </span>
        </p>

        <ul className="console-rows">
          {copy.learning.items.map((item, index) => (
            <li
              className="console-row"
              data-console-row={index}
              key={item.title}
              style={{ "--row-index": index } as CSSProperties}
            >
              <div className="console-row-copy">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <span className="console-state">
                {item.title === "CTF" ? copy.console.ctf : copy.console.learning}
              </span>
            </li>
          ))}
        </ul>

        <p className="console-footer" aria-hidden="true">
          <span>eto@lab</span>
          <span className="console-prompt">&gt;</span>
          <span className="console-caret" />
        </p>
      </div>
    </div>
  );
}
