type TokenEmblemProps = {
  size?: number;
  className?: string;
};

export default function TokenEmblem({ size = 96, className = "" }: TokenEmblemProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="BDNS official token emblem"
    >
      <defs>
        <linearGradient id="bdns-glyph" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8b92ff" />
          <stop offset="55%" stopColor="#5964ff" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="bdns-sheen" x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
        <mask id="bdns-mask">
          <path d="M100 20 L176 100 L100 180 L24 100 Z" fill="#fff" />
          <circle cx="100" cy="100" r="27" fill="#000" />
        </mask>
      </defs>

      {/* crystal body with the token node cut through */}
      <path
        d="M100 20 L176 100 L100 180 L24 100 Z"
        fill="url(#bdns-glyph)"
        mask="url(#bdns-mask)"
      />

      {/* gem sheen on the top-left facet */}
      <path d="M100 20 L148 76 L130 90 L108 40 Z" fill="url(#bdns-sheen)" />

      {/* facet edges */}
      <path d="M100 20 V180" stroke="#0b0e14" strokeWidth="7" opacity="0.7" />
      <path d="M24 100 H176" stroke="#0b0e14" strokeWidth="7" opacity="0.7" />
      <path d="M100 34 L67 100 L100 166 L133 100 Z" stroke="#0b0e14" strokeWidth="5" opacity="0.6" />

      {/* internal facet ring connecting the node */}
      <path d="M100 66 L131 100 L100 134 L69 100 Z" stroke="#0b0e14" strokeWidth="4" opacity="0.5" />

      {/* keyhole focus node */}
      <circle cx="100" cy="100" r="27" stroke="url(#bdns-glyph)" strokeWidth="6" />
    </svg>
  );
}