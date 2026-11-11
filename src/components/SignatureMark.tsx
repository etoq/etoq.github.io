export default function SignatureMark() {
  return (
    <svg
      className="signature-mark"
      viewBox="120 70 640 330"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="eto-about-metal" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#264348" />
          <stop offset=".45" stopColor="#102126" />
          <stop offset=".72" stopColor="#050e11" />
          <stop offset="1" stopColor="#23514b" />
        </linearGradient>
        <linearGradient id="eto-about-rim" x1="0" y1="0" x2=".85" y2="1">
          <stop stopColor="#365b55" />
          <stop offset=".38" stopColor="#6a9a8b" />
          <stop offset=".7" stopColor="#0abab5" />
          <stop offset="1" stopColor="#9cf5e6" />
        </linearGradient>
        <linearGradient id="eto-about-beam">
          <stop stopColor="#0abab5" stopOpacity="0" />
          <stop offset=".5" stopColor="#0abab5" stopOpacity=".12" />
          <stop offset=".69" stopColor="#9cf5e6" stopOpacity=".7" />
          <stop offset=".7" stopColor="#9cf5e6" stopOpacity=".02" />
          <stop offset="1" stopColor="#0abab5" stopOpacity="0" />
        </linearGradient>
        <pattern
          id="eto-about-assembly"
          className="signature-texture"
          width="245"
          height="62"
          patternUnits="userSpaceOnUse"
        >
          <text x="0" y="20">xor byte ptr [rdi], 0xc8</text>
          <text x="0" y="49">inc rdi  dec ecx  jnz</text>
        </pattern>
        <clipPath id="eto-about-mask">
          <text x="425" y="330" textAnchor="middle" className="signature-text">eto</text>
        </clipPath>
      </defs>
      <text
        x="425" y="338" textAnchor="middle"
        className="signature-text signature-shadow"
        fill="#000" stroke="#19342a" strokeWidth="2"
      >eto</text>
      <text
        x="425" y="330" textAnchor="middle" className="signature-text"
        fill="url(#eto-about-metal)" stroke="url(#eto-about-rim)" strokeWidth="1.5"
      >eto</text>
      <g clipPath="url(#eto-about-mask)" className="signature-shine" opacity=".9">
        <rect width="880" height="405" fill="url(#eto-about-assembly)" />
        <rect
          className="signature-beam"
          x="0" y="0" width="230" height="405"
          fill="url(#eto-about-beam)"
        />
        <path
          d="M0 263 880 221"
          className="signature-etched-line"
          fill="none" stroke="#9cf5e6" strokeOpacity=".14" strokeWidth=".6"
        />
      </g>
      <text
        x="425" y="330" textAnchor="middle"
        className="signature-text signature-rim"
        fill="none" stroke="url(#eto-about-rim)" strokeWidth=".9"
      >eto</text>
      <path
        d="M154 372H706" className="signature-ground"
        fill="none" stroke="#0abab5" strokeWidth="1" opacity=".5"
      />
    </svg>
  );
}
