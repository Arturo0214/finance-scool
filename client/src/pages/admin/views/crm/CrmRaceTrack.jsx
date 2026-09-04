/**
 * CrmRaceTrack — "Carrera a tus bonos": la pista donde el carrito avanza hacia
 * los rangos de bono conforme vendes (idea de Arturo: gamificar la meta).
 *
 *  - <BonoRaceTrack/>: pista individual con banderas en cada rango (trimestral
 *    o renovación); el carrito se posiciona por la prima del trimestre y las
 *    banderas alcanzadas se encienden. Muestra el faltante y a cuántas pólizas
 *    promedio equivale.
 *  - <PromotoriaRace/>: carrera de asesores — un carril por asesor (top N por
 *    venta nueva del Q), posición relativa al líder, bono ganado al momento.
 *
 * Todo el dato viene de /crm/ingresos/proyeccion (motor PIR real, corte vivo).
 */
import { useState } from 'react';
import { C } from '../../constants';
import { Flag, Trophy } from 'lucide-react';

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
const short = (n) => {
  const v = Number(n) || 0;
  return v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`;
};

export const raceCSS = `
  .race-wrap{background:linear-gradient(135deg,${C.navy},#0A2A66);border-radius:16px;padding:18px 20px 14px;color:#fff;margin-bottom:20px}
  .race-lane{position:relative;height:38px;margin:26px 6px 8px}
  .race-road{position:absolute;left:0;right:0;top:14px;height:12px;border-radius:7px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.14) 0 14px,rgba(255,255,255,.07) 14px 28px)}
  .race-progress{position:absolute;left:0;top:14px;height:12px;border-radius:7px;background:linear-gradient(90deg,#0088E0,#34d399);transition:width .8s cubic-bezier(.4,0,.2,1)}
  .race-car{position:absolute;top:-4px;font-size:22px;transform:translateX(-60%) scaleX(-1);transition:left .8s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 2px 4px rgba(0,0,0,.4));z-index:2}
  .race-flag{position:absolute;top:-16px;transform:translateX(-50%);text-align:center;font-size:9.5px;line-height:1.15;opacity:.75;z-index:1}
  .race-flag b{display:block;font-size:10px}
  .race-flag.hit{opacity:1;color:#7CE7B1}
  .race-flag .pole{width:2px;height:14px;margin:2px auto 0;background:currentColor;opacity:.6;border-radius:1px}
  .race-finish{position:absolute;right:-2px;top:8px;font-size:16px}
  .race-mini{display:flex;justify-content:space-between;font-size:11px;opacity:.85;margin-top:2px}
  .prace-lane{display:flex;align-items:center;gap:10px;margin:7px 0}
  .prace-name{width:150px;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;opacity:.9}
  .prace-track{position:relative;flex:1;height:16px;background:rgba(255,255,255,.08);border-radius:9px}
  .prace-bar{position:absolute;left:0;top:3px;height:10px;border-radius:6px;background:linear-gradient(90deg,#0088E0,#34d399);transition:width .8s}
  .prace-car{position:absolute;top:-5px;font-size:15px;transform:translateX(-60%) scaleX(-1);transition:left .8s}
  .prace-val{width:150px;font-size:11px;opacity:.9;white-space:nowrap}
`;

/* Pista de UN objetivo con banderas por rango. maxRef = último rango (meta de la pista). */
export function BonoRaceTrack({ titulo, emoji = '🏎️', progreso, rangos = [], faltanteTxt, bloqueado, llevasTxt }) {
  const maxRef = rangos.length ? Math.max(...rangos.map(r => r.prima_min)) * 1.08 : Math.max(progreso, 1);
  const pos = Math.min(0.99, (Number(progreso) || 0) / maxRef);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13 }}>{titulo}</b>
        <span style={{ fontSize: 11.5, opacity: .9 }}>{faltanteTxt}</span>
      </div>
      <div className="race-lane">
        <div className="race-road" />
        <div className="race-progress" style={{ width: `${pos * 100}%` }} />
        {rangos.map(r => {
          const p = Math.min(0.99, r.prima_min / maxRef);
          return (
            <div key={r.rango} className={`race-flag${r.alcanzado ? ' hit' : ''}`} style={{ left: `${p * 100}%` }}
              title={`Rango ${r.rango}: ${money(r.prima_min)} de prima → bono ${money(r.bono)}`}>
              <b>{r.alcanzado ? '✓' : <Flag size={9} style={{ verticalAlign: -1 }} />} R{r.rango}</b>
              {short(r.prima_min)}
              <div className="pole" />
            </div>
          );
        })}
        <span className="race-car" style={{ left: `${pos * 100}%` }}>{bloqueado ? '🚧' : emoji}</span>
        <span className="race-finish">🏁</span>
      </div>
      <div className="race-mini">
        <span>{llevasTxt || <>Llevas <b>{money(progreso)}</b></>}</span>
        {rangos.filter(r => !r.alcanzado)[0] && <span>Bono al llegar a R{rangos.filter(r => !r.alcanzado)[0].rango}: <b>{money(rangos.filter(r => !r.alcanzado)[0].bono)}</b></span>}
      </div>
    </div>
  );
}

/* Carrera de la promotoría: cada asesor ACTIVO un carrito, posición relativa
   al líder. "Ver la parrilla completa" expande a todos. */
export function PromotoriaRace({ carrera = [], max = 12 }) {
  const [verTodos, setVerTodos] = useState(false);
  const top = verTodos ? carrera : carrera.slice(0, max);
  const lider = Math.max(1, ...carrera.map(a => a.pagadaInicialQ));
  const EMOJIS = ['🏎️', '🚗', '🚙', '🛻', '🚕', '🚓', '🚘', '🚖', '🛺', '🚜'];
  return (
    <div>
      {top.map((a, i) => {
        const pos = Math.min(0.99, a.pagadaInicialQ / (lider * 1.06));
        return (
          <div key={a.clave} className="prace-lane">
            <span className="prace-name" title={`${a.nombre} (${a.clave})`}>{i === 0 && <Trophy size={11} color={C.gold} style={{ verticalAlign: -1 }} />} {a.nombre}</span>
            <div className="prace-track">
              <div className="prace-bar" style={{ width: `${pos * 100}%` }} />
              <span className="prace-car" style={{ left: `${pos * 100}%` }}>{a.bloqueado ? '🚧' : EMOJIS[i % EMOJIS.length]}</span>
            </div>
            <span className="prace-val"><b>{short(a.pagadaInicialQ)}</b> · bono {short(a.bono)}{a.bloqueado ? ' ⚠' : ''}</span>
          </div>
        );
      })}
      {carrera.length > max && (
        <button onClick={() => setVerTodos(v => !v)}
          style={{ marginTop: 8, background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.18)', color: '#fff', borderRadius: 9, padding: '6px 14px', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>
          {verTodos ? '▲ Ver menos' : `▼ Ver la parrilla completa (${carrera.length} asesores activos)`}
        </button>
      )}
    </div>
  );
}
