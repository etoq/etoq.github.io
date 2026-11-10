import type { PageContent } from "@/lib/content";

export default function AnalysisVisual({ copy }: { copy: PageContent }) {
  return (
    <figure className="analysis-visual" data-reveal aria-labelledby="analysis-title">
      <figcaption className="analysis-caption"><h3 id="analysis-title">{copy.learning.visualTitle}</h3><p>{copy.learning.visualDescription}</p></figcaption>
      <div className="analysis-workspace">
        <div className="format-view">
          <p className="analysis-label">ELF / x86-64</p>
          <div className="elf-magic"><span>7f</span><span>45</span><span>4c</span><span>46</span></div>
          <p className="format-hint">.text <span>/</span> .rodata <span>/</span> .data</p>
          <div className="binary-contour" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
          <span className="workspace-label">{copy.learning.file}</span>
        </div>
        <div className="string-view">
          <p className="analysis-label">XOR 0xc8</p>
          <div className="string-transform"><span>ad bc a7</span><span className="string-connection" aria-hidden="true" /><strong>65 74 6f</strong><span className="string-output">eto</span></div>
          <span className="workspace-label">{copy.learning.string}</span>
        </div>
      </div>
      <div className="trace-view">
        <div className="trace-description"><p className="analysis-label">{copy.learning.execution}</p><p>{copy.learning.separateExample}</p></div>
        <div className="syscall-list" aria-label={copy.learning.fileNote}>
          <div><span className="syscall-op">openat</span><code>(AT_FDCWD, &quot;./config&quot;, O_RDONLY) <span>= 3</span></code></div>
          <div><span className="syscall-op">read</span><code>{'(3, "mode=local\\n", 64) '}<span>= 11</span></code></div>
          <div><span className="syscall-op">close</span><code>(3) <span>= 0</span></code></div>
        </div>
      </div>
      <svg className="workspace-flow" viewBox="0 0 1000 4" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2H1000" pathLength="1" /></svg>
    </figure>
  );
}
