/**
 * CrmSocioIngresosView — Ingresos para Business Partner (socio)
 * A diferencia del tablero completo de Ingresos (índice de conservación, bonos
 * PIR, rehabilitaciones…), un socio NO es agente: ve una sola cifra, su
 * participación = participacionPct % de su prima nueva del trimestre en curso.
 * Fuente: GET /api/crm/ingresos/overview (scope restringido → solo su cartera).
 */
import { useState, useEffect } from 'react';
import { api } from '../../../../utils/api';
import { C } from '../../constants';
import { getCrmCSS, fmtMoneyFull } from './crmShared';
import { HandCoins, TrendingUp, RotateCcw, Info, Handshake } from 'lucide-react';

const TRIM_LABEL = ['', '1.º', '2.º', '3.º', '4.º'];

const SOCIO_CSS = `
.socio-hero{background:linear-gradient(135deg,#0A1730 0%,#132749 55%,#1C355F 100%);border-radius:20px;padding:34px 32px;color:#fff;position:relative;overflow:hidden;box-shadow:0 18px 44px rgba(10,23,48,.22)}
.socio-hero::after{content:'';position:absolute;top:-70px;right:-50px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(193,151,91,.28),transparent 68%)}
.socio-hero *{position:relative;z-index:1}
.socio-card{background:#fff;border:1px solid #E4E8F0;border-radius:16px;padding:22px;box-shadow:0 1px 2px rgba(16,35,59,.04)}
.socio-stat{font-family:ui-serif,Georgia,'Times New Roman',serif;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
`;

function money(n) { return fmtMoneyFull(n); }

export default function CrmSocioIngresosView({ participacionPct = 10 }) {
  const [data, setData]   = useState(null);
  const [loading, setLoad] = useState(true);
  const [err, setErr]     = useState(null);
  const factor = (Number(participacionPct) || 10) / 100;

  const load = async () => {
    setLoad(true); setErr(null);
    try {
      const d = await api.crmIngresosOverview();
      setData((d.agentes || [])[0] || null);
    } catch (e) { setErr(e.message || 'No se pudo cargar tus ingresos'); }
    finally { setLoad(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <><style>{getCrmCSS() + SOCIO_CSS}</style><div className="loading-wrap"><div className="spinner" /><p>Cargando tu participación…</p></div></>;
  if (err) return <><style>{getCrmCSS() + SOCIO_CSS}</style><div className="view"><p style={{ color: C.red, padding: 24 }}>⚠️ {err} <button className="f-tab" onClick={load} style={{ marginLeft: 12 }}>Reintentar</button></p></div></>;

  const primas = data?.primas || { ubicacionQ: 0, pagadaInicialQ: 0, renovacionQ: 0 };
  const primaNueva = Number(primas.ubicacionQ) || 0;
  const renovacion = Number(primas.renovacionQ) || 0;
  const participacion = primaNueva * factor;
  const periodo = data?.periodo;
  const pctLabel = `${Math.round(factor * 100)}%`;
  const trimTxt = periodo ? `${TRIM_LABEL[periodo.trimestre] || periodo.trimestre} trimestre ${periodo.anio}` : 'trimestre en curso';

  return (
    <div className="view">
      <style>{getCrmCSS() + SOCIO_CSS}</style>

      <div className="crm-toolbar">
        <div>
          <h1 className="view-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><HandCoins size={22} /> Ingresos</h1>
          <p className="view-subtitle">Tu participación como Business Partner · {trimTxt}</p>
        </div>
      </div>

      {/* Hero: la participación del socio */}
      <div className="socio-hero" style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, opacity: .85, fontWeight: 600, letterSpacing: '.02em', textTransform: 'uppercase' }}>
          <Handshake size={16} color={C.gold} /> Participación de socio ({pctLabel})
        </div>
        <div className="socio-stat" style={{ fontSize: 'clamp(38px, 7vw, 58px)', fontWeight: 700, margin: '10px 0 4px', lineHeight: 1 }}>
          {money(participacion)}
        </div>
        <div style={{ fontSize: 14, opacity: .82 }}>
          {pctLabel} de tu prima nueva del {trimTxt} ({money(primaNueva)}).
        </div>
        {!data && (
          <div style={{ marginTop: 14, fontSize: 13, background: 'rgba(255,255,255,.1)', borderRadius: 10, padding: '10px 14px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Info size={15} /> Aún no hay producción registrada en tu clave. Tu participación se actualizará en cuanto entren pólizas a tu cartera.
          </div>
        )}
      </div>

      {/* Desglose de la base */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="socio-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textMuted, fontSize: 12.5, fontWeight: 600 }}>
            <TrendingUp size={15} color={C.gold} /> Prima nueva (base)
          </div>
          <div className="socio-stat" style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 2px', color: C.ink }}>{money(primaNueva)}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>Venta nueva del {trimTxt}</div>
        </div>
        <div className="socio-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textMuted, fontSize: 12.5, fontWeight: 600 }}>
            <Handshake size={15} color={C.primary} /> Tu {pctLabel}
          </div>
          <div className="socio-stat" style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 2px', color: C.primary }}>{money(participacion)}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>Participación sobre la prima nueva</div>
        </div>
        <div className="socio-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textMuted, fontSize: 12.5, fontWeight: 600 }}>
            <RotateCcw size={15} color={C.textMuted} /> Renovación (cartera)
          </div>
          <div className="socio-stat" style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 2px', color: C.ink }}>{money(renovacion)}</div>
          <div style={{ fontSize: 12, color: C.textLight }}>Informativo · no entra en tu participación</div>
        </div>
      </div>

      {/* Explicación */}
      <div className="socio-card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Info size={18} color={C.primary} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
          Como <b>Business Partner</b> tu ingreso es el <b>{pctLabel} de la prima nueva</b> que genera tu cartera
          (no el 100% de la comisión del agente). La cifra corresponde al <b>{trimTxt}</b> y se recalcula
          automáticamente conforme se registran tus pólizas.
        </div>
      </div>
    </div>
  );
}
