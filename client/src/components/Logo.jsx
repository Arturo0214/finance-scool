export default function Logo({ height = 40, variant = 'dark', layout = 'stacked', animated = false }) {
  const textColor = variant === 'light' ? '#FFFFFF' : '#1A3A5C';
  const financeColor = variant === 'light' ? '#5B9BD5' : '#2E6EA6';
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

  if (layout === 'inline') {
    // FINANCE  S  C  ∞  L — with proper spacing so ∞ doesn't overlap C
    // FINANCE(0-165) gap S(180) gap C(210) gap ∞(center=271, from 234-308) gap L(322)
    const cx = 291; // infinity center x — centered between C(~235) and L(346)
    const SH = [
      { d: `M ${cx} 28 C ${cx-5} 19, ${cx-14} 12, ${cx-22} 12`,  x1:cx,y1:28, x2:cx-22,y2:12, c1:'#43A047', c2:'#FDD835' },
      { d: `M ${cx-22} 12 C ${cx-31} 12, ${cx-37} 19, ${cx-37} 28`, x1:cx-22,y1:12, x2:cx-37,y2:28, c1:'#FDD835', c2:'#FF8F00' },
      { d: `M ${cx-37} 28 C ${cx-37} 37, ${cx-31} 44, ${cx-22} 44`, x1:cx-37,y1:28, x2:cx-22,y2:44, c1:'#FF8F00', c2:'#E91E63' },
      { d: `M ${cx-22} 44 C ${cx-14} 44, ${cx-5} 37, ${cx} 28`,    x1:cx-22,y1:44, x2:cx,y2:28, c1:'#E91E63', c2:'#00ACC1' },
      { d: `M ${cx} 28 C ${cx+5} 19, ${cx+14} 12, ${cx+22} 12`,    x1:cx,y1:28, x2:cx+22,y2:12, c1:'#00ACC1', c2:'#FF6D00' },
      { d: `M ${cx+22} 12 C ${cx+31} 12, ${cx+37} 19, ${cx+37} 28`,x1:cx+22,y1:12, x2:cx+37,y2:28, c1:'#FF6D00', c2:'#E53935' },
      { d: `M ${cx+37} 28 C ${cx+37} 37, ${cx+31} 44, ${cx+22} 44`,x1:cx+37,y1:28, x2:cx+22,y2:44, c1:'#E53935', c2:'#3949AB' },
      { d: `M ${cx+22} 44 C ${cx+14} 44, ${cx+5} 37, ${cx} 28`,    x1:cx+22,y1:44, x2:cx,y2:28, c1:'#3949AB', c2:'#43A047' },
    ];

    // Smooth RGB animation: each segment cycles through all 8 colors with seamless loop
    const allColors = ['#43A047','#FDD835','#FF8F00','#E91E63','#00ACC1','#FF6D00','#E53935','#3949AB'];
    const getColorCycle = (offset) => {
      const shifted = [];
      for (let j = 0; j <= 8; j++) shifted.push(allColors[(offset + j) % 8]);
      return shifted.join(';');
    };

    return (
      <svg viewBox="0 0 370 56" height={height} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
        <defs>
          {SH.map((s, i) => (
            <linearGradient key={i} id={`ih-${u}-${i}`} gradientUnits="userSpaceOnUse" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}>
              <stop offset="0%" stopColor={s.c1}>
                {animated && (
                  <animate attributeName="stop-color" values={getColorCycle(i)} dur="4s" repeatCount="indefinite" />
                )}
              </stop>
              <stop offset="100%" stopColor={s.c2}>
                {animated && (
                  <animate attributeName="stop-color" values={getColorCycle((i+1)%8)} dur="4s" repeatCount="indefinite" />
                )}
              </stop>
            </linearGradient>
          ))}
        </defs>
        {/* FINANCE */}
        <text x="0" y="36" fontFamily="'Montserrat','Inter',sans-serif" fontSize="30" fontWeight="800" fill={financeColor} letterSpacing="2">FINANCE</text>
        {/* S */}
        <text x="180" y="36" fontFamily="'Montserrat','Inter',sans-serif" fontSize="30" fontWeight="800" fill={textColor}>S</text>
        {/* C */}
        <text x="215" y="36" fontFamily="'Montserrat','Inter',sans-serif" fontSize="30" fontWeight="800" fill={textColor}>C</text>
        {/* ∞ BACK — behind the crossing */}
        {back.map(i => (
          <path key={`bh${i}`} d={SH[i].d} stroke={`url(#ih-${u}-${i})`} strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {/* ∞ FRONT — on top at crossing */}
        {front.map(i => (
          <path key={`fh${i}`} d={SH[i].d} stroke={`url(#ih-${u}-${i})`} strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {/* L */}
        <text x="346" y="36" fontFamily="'Montserrat','Inter',sans-serif" fontSize="30" fontWeight="800" fill={textColor}>L</text>
        {/* Accent line */}
        <line x1="0" y1="52" x2="366" y2="52" stroke="#F26522" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

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
