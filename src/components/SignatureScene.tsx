import type { PageContent } from "@/lib/content";

const instructions = [
  { op: "mov", argument: "ecx, 3" },
  { op: "xor", argument: "byte ptr [rdi], 0xc8" },
  { op: "inc", argument: "rdi" },
  { op: "dec", argument: "ecx" },
  { op: "jnz", argument: "decode_byte" },
  { op: "ret", argument: "" },
];

export default function SignatureScene({ copy }: { copy: PageContent }) {
  return (
    <section id="top" className="story-scene hero" data-scene="0" data-hero aria-labelledby="hero-title">
      <div className="scene-panel hero-panel">
        <div className="scene-content hero-content">
          <div className="signature" data-signature>
            <svg className="signature-svg" viewBox="0 0 880 405" role="img" aria-label="eto">
              <defs>
                <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#264348" />
                  <stop offset=".45" stopColor="#102126" />
                  <stop offset=".72" stopColor="#050e11" />
                  <stop offset="1" stopColor="#23514b" />
                </linearGradient>
                <linearGradient id="rim" x1="0" y1="0" x2=".85" y2="1">
                  <stop stopColor="#365b55" />
                  <stop offset=".38" stopColor="#6a9a8b" />
                  <stop offset=".7" stopColor="#0abab5" />
                  <stop offset="1" stopColor="#9cf5e6" />
                </linearGradient>
                <linearGradient id="beam">
                  <stop stopColor="#0abab5" stopOpacity="0" />
                  <stop offset=".5" stopColor="#0abab5" stopOpacity=".12" />
                  <stop offset=".69" stopColor="#9cf5e6" stopOpacity=".7" />
                  <stop offset=".7" stopColor="#9cf5e6" stopOpacity=".02" />
                  <stop offset="1" stopColor="#0abab5" stopOpacity="0" />
                </linearGradient>
                <pattern id="assembly-texture" width="245" height="62" patternUnits="userSpaceOnUse">
                  <text x="0" y="20">xor byte ptr [rdi], 0xc8</text>
                  <text x="0" y="49">inc rdi  dec ecx  jnz</text>
                </pattern>
                <clipPath id="signature-mask"><text x="425" y="330" textAnchor="middle" className="signature-text">eto</text></clipPath>
              </defs>
              <text x="425" y="338" textAnchor="middle" className="signature-text signature-shadow">eto</text>
              <text x="425" y="330" textAnchor="middle" className="signature-text" fill="url(#metal)" stroke="url(#rim)" strokeWidth="1.5">eto</text>
              <g clipPath="url(#signature-mask)" className="signature-interior">
                <rect width="880" height="405" fill="url(#assembly-texture)" />
                <rect className="signature-beam" x="0" y="0" width="230" height="405" fill="url(#beam)" />
                <path d="M0 263 880 221" className="etched-line" />
              </g>
              <text x="425" y="330" textAnchor="middle" className="signature-text signature-rim" fill="none" stroke="url(#rim)" strokeWidth=".9">eto</text>
              <path d="M154 372H706" className="signature-ground" />
            </svg>
          </div>
          <h1 id="hero-title">Malware analysis</h1>
          <p className="hero-subtitle">Linux &amp; reverse engineering</p>
          <div className="decode-panel" aria-label={copy.motionDescription}>
            <div className="cycle-code" aria-hidden="true">
              {instructions.map((instruction, index) => (
                <code key={instruction.op} className={`cycle-instruction${index === 5 ? " is-current" : ""}`} data-instruction={index}>
                  <span>{instruction.op}</span>{" "}{instruction.argument}
                </code>
              ))}
            </div>
            <div className="decode-values">
              <div className="byte-group">
                {["65", "74", "6f"].map((byte, index) => <span key={byte} data-byte={index} data-done="true">{byte}</span>)}
              </div>
              <span className="decoded-name" data-decoded-name>eto</span>
              <span className="register">ecx <strong data-ecx>0</strong></span>
            </div>
          </div>
          <a className="scroll-cue" href="#about" aria-label={copy.navigation.about}>
            <span>{copy.scroll}</span><i aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
