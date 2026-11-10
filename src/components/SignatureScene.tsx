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
    <section className="hero" data-hero aria-labelledby="hero-title">
      <div className="hero-intro">
        <div>
          <h1 id="hero-title">Malware analysis</h1>
          <p className="hero-subtitle">Linux &amp; reverse engineering</p>
        </div>
        <p className="hero-copy">{copy.intro}</p>
      </div>

      <div className="signature-stage">
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

        <div className="listing" aria-label={`x86-64. ${copy.motionDescription}`}>
          <span className="listing-architecture">x86-64</span>
          <div className="code-label">eto:</div>
          {instructions.map((instruction, index) => (
            <div key={instruction.op}>
              {index === 1 && <div className="code-label loop-label">decode_byte:</div>}
              <div className={`instruction${index === 5 ? " is-current" : ""}`} data-instruction={index}>
                <span className="instruction-op">{instruction.op}</span>{" "}
                {instruction.argument && <span>{instruction.argument}</span>}
              </div>
            </div>
          ))}
          <div className="register"><span>ecx</span><strong data-ecx>0</strong><span>{copy.remaining}</span></div>
        </div>
      </div>

      <div className="decode-strip" aria-label={copy.motionDescription}>
        <div>
          <p className="small-label">{copy.decoded}</p>
          <div className="decode-values">
            <div className="byte-group">
              {["65", "74", "6f"].map((byte, index) => <span key={byte} data-byte={index} data-done="true">{byte}</span>)}
            </div>
            <span className="xor-key">XOR 0xc8</span>
            <span className="decoded-name" data-decoded-name>eto</span>
          </div>
        </div>
        <span className="hero-descent" aria-hidden="true"><span /></span>
      </div>

      <div className="hero-outro">
        <div><p>{copy.heroNote}</p><p className="hero-outro-description">{copy.heroNoteBody}</p></div>
        <div className="motion-controls">
          <button type="button" data-motion="replay">{copy.replay}</button>
          <button type="button" data-motion="pause" aria-pressed="false">{copy.pause}</button>
        </div>
      </div>
    </section>
  );
}
