type DiagramProps = {
  className?: string;
};

export function Layer2FlowDiagram({ className = "" }: DiagramProps) {
  return (
    <svg viewBox="0 0 640 220" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} role="img" aria-label="Layer 2 flow diagram">
      <defs>
        <linearGradient id="l2-dash" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <radialGradient id="l2-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="640" height="220" rx="18" fill="#0a0f14" stroke="#22d3ee" strokeOpacity="0.25" />

      {/* client node */}
      <circle cx="70" cy="110" r="26" fill="#0a1418" stroke="url(#l2-dash)" strokeWidth="2" />
      <g stroke="#67e8f9" strokeWidth="1.4">
        <path d="M70 102 v16 M62 110 h16" />
      </g>
      <text x="70" y="160" textAnchor="middle" fill="#67e8f9" fontSize="11" fontFamily="monospace">Client</text>
      <text x="70" y="174" textAnchor="middle" fill="#164e63" fontSize="9" fontFamily="monospace">DNS lookup</text>

      {/* L2 chain box */}
      <rect x="210" y="52" width="220" height="116" rx="12" fill="#0b1520" stroke="url(#l2-dash)" strokeWidth="1.6" />
      <rect x="210" y="52" width="220" height="22" rx="12" fill="#083344" />
      <text x="320" y="67" textAnchor="middle" fill="#a5f3fc" fontSize="11" fontWeight="700" fontFamily="monospace">BLOCKDNS L2</text>
      <g fontFamily="monospace" fontSize="9" fill="#7dd3fc">
        <text x="224" y="92">Registry</text>
        <text x="224" y="108">Resolver</text>
        <text x="224" y="124">Marketplace</text>
        <text x="224" y="140">BDNS token</text>
      </g>
      <circle cx="404" cy="96" r="10" fill="none" stroke="#38bdf8" strokeWidth="1.2" />
      <circle cx="404" cy="96" r="3.4" fill="#22d3ee" />

      {/* L1 link */}
      <rect x="500" y="52" width="120" height="116" rx="12" fill="#0b1018" stroke="#64748b" strokeOpacity="0.6" strokeWidth="1.4" />
      <text x="560" y="67" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700" fontFamily="monospace">LAYER 1</text>
      <text x="560" y="92" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace">Settlement</text>
      <text x="560" y="106" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace">Bridge</text>

      {/* arrows */}
      <g stroke="url(#l2-dash)" strokeWidth="2" markerEnd="none">
        <path d="M96 110 H184" />
        <path d="M430 96 H500" strokeDasharray="5 4" />
      </g>
      <g fill="#22d3ee">
        <polygon points="186 110 172 104 172 116" />
        <polygon points="500 96 488 90 488 102" />
      </g>

      {/* glow */}
      <circle cx="320" cy="110" r="60" fill="url(#l2-glow)" />
    </svg>
  );
}

export function NetworkMapDiagram({ className = "" }: DiagramProps) {
  return (
    <svg viewBox="0 0 640 220" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} role="img" aria-label="Global network map diagram">
      <defs>
        <radialGradient id="net-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="640" height="220" rx="18" fill="#0a0f14" stroke="#38bdf8" strokeOpacity="0.22" />
      <circle cx="320" cy="110" r="95" fill="url(#net-glow)" />

      {/* land-mass hints */}
      <g fill="none" stroke="#164e63" strokeWidth="1" opacity="0.6">
        <ellipse cx="190" cy="90" rx="52" ry="30" />
        <ellipse cx="430" cy="80" rx="60" ry="34" />
        <ellipse cx="340" cy="160" rx="70" ry="26" />
        <ellipse cx="110" cy="160" rx="40" ry="22" />
        <ellipse cx="540" cy="170" rx="42" ry="20" />
      </g>

      {/* linked nodes around the globe */}
      {[
        [90, 90],
        [210, 60],
        [330, 44],
        [450, 66],
        [560, 96],
        [140, 176],
        [300, 186],
        [440, 172],
        [560, 168],
        [320, 110],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i === 9 ? 7 : 3.6} fill={i === 9 ? "#22d3ee" : "#0ea5e9"} opacity={i === 9 ? 1 : 0.9} />
      ))}

      {/* connections */}
      <g stroke="#22d3ee" strokeWidth="1.1" opacity="0.55">
        <path d="M90 90 L210 60 L330 44 L450 66 L560 96" />
        <path d="M90 90 L140 176 L300 186 L440 172 L560 168 L560 96" />
        <path d="M210 60 L300 186" />
        <path d="M450 66 L440 172" />
        <path d="M330 44 L320 110" strokeOpacity="0.85" />
        <path d="M320 110 L300 186" strokeDasharray="3 3" strokeOpacity="0.85" />
      </g>
      <circle cx="320" cy="110" r="16" fill="none" stroke="#22d3ee" strokeWidth="1.6" />
      <circle cx="320" cy="110" r="4" fill="#a5f3fc" />

      <g fontFamily="monospace" fill="#67e8f9" fontSize="8.5">
        <text x="90" y="132">EU</text>
        <text x="310" y="38" fill="#22d3ee">L2 NODE</text>
        <text x="560" y="206">APAC</text>
        <text x="128" y="200">AF</text>
      </g>
      <text x="320" y="210" textAnchor="middle" fill="#38bdf8" fontSize="9" fontFamily="monospace" opacity="0.8">
        distributed .bdns network
      </text>
    </svg>
  );
}