export default function Logo({ height = 40, variant = 'dark' }) {
  const textColor = variant === 'light' ? '#FFFFFF' : '#1A3A5C';
  const financeColor = variant === 'light' ? '#FFFFFF' : '#2E6EA6';
  const u = variant;

  // Infinity: two nearly-circular loops (rx≈16, ry≈16)
  // Left loop center: (92, 43), Right loop center: (142, 43)
  // Crossing at: (117, 43)
  // Each loop ~32px wide × 32px tall → rounder shape like reference
  const S = [
    // LEFT LOOP
    { d: 'M 117 43 C 112 34, 104 27, 92 27',  x1:117,y1:43, x2:92, y2:27, c1:'#43A047', c2:'#FDD835' },
    { d: 'M 92 27 C 82 27, 76 34, 76 43',      x1:92, y1:27, x2:76, y2:43, c1:'#FDD835', c2:'#FF8F00' },
    { d: 'M 76 43 C 76 52, 82 59, 92 59',      x1:76, y1:43, x2:92, y2:59, c1:'#FF8F00', c2:'#E91E63' },
    { d: 'M 92 59 C 104 59, 112 52, 117 43',   x1:92, y1:59, x2:117,y2:43, c1:'#E91E63', c2:'#00ACC1' },
    // RIGHT LOOP
    { d: 'M 117 43 C 122 34, 130 27, 142 27',  x1:117,y1:43, x2:142,y2:27, c1:'#00ACC1', c2:'#FF6D00' },
    { d: 'M 142 27 C 152 27, 158 34, 158 43',  x1:142,y1:27, x2:158,y2:43, c1:'#FF6D00', c2:'#E53935' },
    { d: 'M 158 43 C 158 52, 152 59, 142 59',  x1:158,y1:43, x2:142,y2:59, c1:'#E53935', c2:'#3949AB' },
    { d: 'M 142 59 C 130 59, 122 52, 117 43',  x1:142,y1:59, x2:117,y2:43, c1:'#3949AB', c2:'#43A047' },
  ];

  const back  = [0, 1, 6, 7];
  const front = [2, 3, 4, 5];

  return (
    <svg
      viewBox="0 0 200 78"
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        {S.map((s, i) => (
          <linearGradient
            key={i}
            id={`ig-${u}-${i}`}
            gradientUnits="userSpaceOnUse"
            x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          >
            <stop offset="0%" stopColor={s.c1} />
            <stop offset="100%" stopColor={s.c2} />
          </linearGradient>
        ))}
      </defs>

      {/* "FINANCE" centered above SCOOL */}
      <text
        x="100" y="16"
        fontFamily="'Inter','Helvetica Neue',Arial,sans-serif"
        fontSize="13.5"
        fontWeight="600"
        letterSpacing="6"
        fill={financeColor}
        textAnchor="middle"
      >FINANCE</text>

      {/* "S" */}
      <text
        x="16" y="56"
        fontFamily="'Inter','Helvetica Neue',Arial,sans-serif"
        fontSize="38"
        fontWeight="700"
        fill={textColor}
        textAnchor="middle"
      >S</text>

      {/* "C" */}
      <text
        x="50" y="56"
        fontFamily="'Inter','Helvetica Neue',Arial,sans-serif"
        fontSize="38"
        fontWeight="700"
        fill={textColor}
        textAnchor="middle"
      >C</text>

      {/* ∞ BACK layer */}
      {back.map(i => (
        <path
          key={`b${i}`}
          d={S[i].d}
          stroke={`url(#ig-${u}-${i})`}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* ∞ FRONT layer (crossing on top) */}
      {front.map(i => (
        <path
          key={`f${i}`}
          d={S[i].d}
          stroke={`url(#ig-${u}-${i})`}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* "L" */}
      <text
        x="180" y="56"
        fontFamily="'Inter','Helvetica Neue',Arial,sans-serif"
        fontSize="38"
        fontWeight="700"
        fill={textColor}
        textAnchor="middle"
      >L</text>

      {/* Orange accent line */}
      <line
        x1="4" y1="72"
        x2="194" y2="72"
        stroke="#F26522"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
