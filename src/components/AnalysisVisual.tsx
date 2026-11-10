import type { PageContent } from "@/lib/content";

const layerOutline = "M310 250 735 140 1020 265 595 375Z";

export default function AnalysisVisual({ copy }: { copy: PageContent }) {
  return (
    <figure className="analysis-visual" data-analysis-scene data-reveal aria-labelledby="analysis-title">
      <figcaption className="analysis-caption">
        <div>
          <h3 id="analysis-title">{copy.learning.visualTitle}</h3>
          <p>{copy.learning.visualDescription}</p>
        </div>
        <span className="analysis-format" aria-hidden="true">ELF</span>
      </figcaption>
      <div className="elf-sculpture">
        <svg viewBox="0 0 1120 540" role="img" aria-label={copy.learning.visualLabel}>
          <defs>
            <linearGradient id="elf-surface" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#142c2d" stopOpacity=".94" />
              <stop offset=".58" stopColor="#091517" stopOpacity=".97" />
              <stop offset="1" stopColor="#0d2725" stopOpacity=".9" />
            </linearGradient>
            <linearGradient id="elf-edge">
              <stop stopColor="#386b61" />
              <stop offset=".5" stopColor="#9cf5e6" />
              <stop offset="1" stopColor="#0abab5" stopOpacity=".25" />
            </linearGradient>
            <linearGradient id="elf-scan">
              <stop stopColor="#0abab5" stopOpacity="0" />
              <stop offset=".8" stopColor="#0abab5" stopOpacity=".04" />
              <stop offset=".98" stopColor="#9cf5e6" stopOpacity=".65" />
              <stop offset="1" stopColor="#9cf5e6" stopOpacity="0" />
            </linearGradient>
            <pattern id="elf-grid" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="matrix(1 -.26 1 .44 0 0)">
              <path d="M34 0H0V34" fill="none" stroke="#9cf5e6" strokeOpacity=".085" strokeWidth="1" />
            </pattern>
            <clipPath id="elf-plane"><path d={layerOutline} /></clipPath>
          </defs>

          <ellipse className="elf-shadow" cx="670" cy="457" rx="300" ry="30" />
          <g className="elf-axis" aria-hidden="true">
            <path d="M310 130V360M735 20V250M1020 145V375M595 255V485" />
          </g>

          {[
            { name: ".data", className: "elf-layer-data" },
            { name: ".rodata", className: "elf-layer-rodata" },
            { name: ".text", className: "elf-layer-text" },
          ].map((layer) => (
            <g className={`elf-layer ${layer.className}`} key={layer.name}>
              <text className="elf-layer-label" x="76" y="256">{layer.name}</text>
              <path className="elf-leader" d="M190 250H275L310 250" />
              <path className="elf-plane" d={layerOutline} />
              <path d={layerOutline} fill="url(#elf-grid)" />
              <g clipPath="url(#elf-plane)">
                <g className="elf-traces">
                  <path d="m380 252 120-31 75 33 105-27 80 35" />
                  <path d="m472 294 118-31 82 36 151-39" />
                  <path d="m586 196 80 35 118-31 96 42" />
                  <circle cx="380" cy="252" r="3" />
                  <circle cx="823" cy="260" r="3" />
                  <circle cx="880" cy="242" r="3" />
                </g>
                <path className="elf-scan" d="M-160 60H0V450H-160Z" />
              </g>
              <path className="elf-front-edge" d="M310 250 595 375 1020 265" />
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}
