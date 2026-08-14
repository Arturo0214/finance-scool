/**
 * CrmCarteraSection — Cartera Prudential segmentada por año de emisión +
 * comparativo dinámico (mes / trimestre / año contra ejercicios anteriores).
 * Fuente: /api/crm/cartera/resumen (la base del Reporte de pólizas de carga
 * diaria, sin contenedores ni duplicados). Scoped: el asesor solo ve lo suyo.
 * Se usa en Tableros CRM y en Metas & Forecast.
 */
import { useState, useEffect } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import { MESES, fmtMoney, fmtMoneyFull } from './crmShared';

const COLORES_ANIO = ['#C1975B', '#003DA5', '#0E7C6B', '#8B5CF6', '#DB2777', '#D97706', '#0891B2'];

export default function CrmCarteraSection({ titulo = 'Cartera Prudential', compacto = false }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [bloque, setBloque] = useState('todos');
  const [gran, setGran] = useState('mes');       // mes | trimestre | anio
  const [metrica, setMetrica] = useState('prima'); // prima | polizas

  useEffect(() => {
    api.crmCarteraResumen().then(setData).catch(e => setErr(e.message));
  }, []);

  if (err) return <div className="info-box" style={{ background: C.redBg, color: C.red, marginBottom: 16 }}><p>{err}</p></div>;
  if (!data) return null;

  const t = data.totales;
  const segmentosVisibles = bloque === 'todos' ? data.segmentos : data.segmentos.filter(s => String(s.bloque) === bloque);

  /* Serie → estructura del comparativo */
  const anios = [...new Set(data.serie.map(s => s.anio))].sort();
  const ultimos = anios.slice(-5); // hasta 5 años en el chart
  let chartData, esBarra = false;
  if (gran === 'anio') {
    esBarra = true;
    chartData = anios.map(a => ({
      etiqueta: String(a),
      Valor: Math.round(data.serie.filter(s => s.anio === a).reduce((sum, s) => sum + s[metrica], 0)),
    }));
  } else {
    const buckets = gran === 'mes'
      ? MESES.map((m, i) => ({ etiqueta: m, filtro: (s) => s.mes === i + 1 }))
      : [1, 2, 3, 4].map(q => ({ etiqueta: `Q${q}`, filtro: (s) => Math.ceil(s.mes / 3) === q }));
    chartData = buckets.map(b => {
      const row = { etiqueta: b.etiqueta };
      for (const a of ultimos) {
        row[a] = Math.round(data.serie.filter(s => s.anio === a && b.filtro(s)).reduce((sum, s) => sum + s[metrica], 0));
      }
      return row;
    });
  }
  const fmtVal = (v) => metrica === 'prima' ? fmtMoneyFull(v) : v;

  return (
    <>
      {/* ── KPIs de la cartera ── */}
      <div className="crm-chart-card">
        <h3>{titulo}</h3>
        <p className="sub">
          Base del Reporte de pólizas (carga diaria) · prima nueva/arrastre = pólizas emitidas en los últimos 12 meses; renovaciones por bloques anuales
        </p>
        <div className="crm-kpi-detail">
          <div className="crm-kpi-box"><div className="k-label">Pólizas</div><div className="k-value">{t.polizas}</div><div className="k-sub">{t.vigentes} vigentes · {t.canceladas} canceladas</div></div>
          <div className="crm-kpi-box"><div className="k-label">Clientes</div><div className="k-value">{t.clientes}</div><div className="k-sub">con nombre real</div></div>
          <div className="crm-kpi-box"><div className="k-label">Prima nueva (arrastre 12m)</div><div className="k-value">{fmtMoney(t.primaNueva)}</div><div className="k-sub">emitidas ago 2025 → hoy</div></div>
          <div className="crm-kpi-box"><div className="k-label">Prima en renovación</div><div className="k-value">{fmtMoney(t.primaRenovacion)}</div><div className="k-sub">bloques de 12+ meses</div></div>
        </div>

        {/* filtro por año/bloque */}
        <div className="filter-tabs" style={{ marginBottom: 10 }}>
          <button className={`f-tab${bloque === 'todos' ? ' active' : ''}`} onClick={() => setBloque('todos')}>Todos</button>
          {data.segmentos.map(s => (
            <button key={s.bloque} className={`f-tab${String(s.bloque) === String(bloque) ? ' active' : ''}`} onClick={() => setBloque(String(s.bloque))}>
              {s.bloque === 'sin_fecha' ? 'Sin fecha' : s.bloque === 0 ? 'Año 1' : `${s.bloque}ª renov.`} ({s.polizas})
            </button>
          ))}
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Bloque</th><th>Pólizas</th><th>Clientes</th><th>Prima</th><th>Estatus</th></tr></thead>
            <tbody>
              {segmentosVisibles.map(s => (
                <tr key={s.bloque}>
                  <td><b>{s.etiqueta}</b></td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.polizas}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.clientes}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(s.prima)}</td>
                  <td style={{ fontSize: 12 }}>
                    {(s.estatus.pagada || 0) > 0 && <span className="badge" style={{ background: C.greenBg, color: C.green, marginRight: 4 }}>{s.estatus.pagada} pagadas</span>}
                    {(s.estatus.pendiente_pago || 0) > 0 && <span className="badge" style={{ background: C.amberBg, color: C.amber, marginRight: 4 }}>{s.estatus.pendiente_pago} por cobrar</span>}
                    {(s.estatus.cancelada || 0) > 0 && <span className="badge" style={{ background: C.redBg, color: C.red }}>{s.estatus.cancelada} canceladas</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Comparativo dinámico ── */}
      {!compacto && (
        <div className="crm-chart-card">
          <h3>Comparativo contra ejercicios anteriores</h3>
          <p className="sub">Producción por fecha de emisión — contrasta el ejercicio actual con meses, trimestres o años pasados para tomar decisiones.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {[['mes', 'Mes con mes'], ['trimestre', 'Trimestre'], ['anio', 'Año con año']].map(([id, label]) => (
              <button key={id} className={`f-tab${gran === id ? ' active' : ''}`} onClick={() => setGran(id)}>{label}</button>
            ))}
            <span style={{ width: 12 }} />
            {[['prima', 'Prima'], ['polizas', 'Pólizas']].map(([id, label]) => (
              <button key={id} className={`f-tab${metrica === id ? ' active' : ''}`} onClick={() => setMetrica(id)}>{label}</button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={290}>
            {esBarra ? (
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11.5, fill: C.textMuted }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={metrica === 'prima' ? fmtMoney : undefined} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} width={62} />
                <Tooltip formatter={fmtVal} />
                <Bar dataKey="Valor" fill={C.gold} radius={[6, 6, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11.5, fill: C.textMuted }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={metrica === 'prima' ? fmtMoney : undefined} tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} width={62} />
                <Tooltip formatter={fmtVal} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {ultimos.map((a, i) => (
                  <Line key={a} type="monotone" dataKey={a} name={String(a)}
                    stroke={COLORES_ANIO[i % COLORES_ANIO.length]}
                    strokeWidth={a === ultimos[ultimos.length - 1] ? 3 : 1.8}
                    strokeDasharray={a === ultimos[ultimos.length - 1] ? undefined : '5 4'} dot={false} />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}
