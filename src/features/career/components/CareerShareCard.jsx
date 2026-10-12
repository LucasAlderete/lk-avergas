// ============================================================================
// CAREER SHARE CARD — tarjeta final para compartir (como la de Copero)
// ============================================================================
// Al retirarse: la "carta" de la carrera con la foto del amigo, OVR final y
// pico, números, títulos y recorrido de clubes. "Compartir" genera una imagen
// (canvas, sin librerías) y la manda por el menú nativo del celular
// (WhatsApp, etc.). Si el navegador no comparte archivos, la descarga y copia
// un resumen en texto.
// ============================================================================

import { useState } from 'react';
import { Share2 } from 'lucide-react';

import { photoOf } from '../../../playerPhotos.js';
import { DASH, formatMoney, positionLabel, reportClubVisual, safeNumber } from './careerFormat.js';
import ClubBadge from './ClubBadge.jsx';
import TrophyArt from './TrophyArt.jsx';
import { trophyImage } from '../trophies.js';

/** Copas agrupadas: [{ trophy, count }] en el orden en que se ganó cada una. */
function groupCups(trophies) {
  const map = new Map();
  [...trophies].filter(Boolean).sort((a, b) => (a.season || 0) - (b.season || 0)).forEach((t) => {
    const key = t.trophyId || t.type || t.label;
    const entry = map.get(key) || { trophy: t, count: 0, seasons: [] };
    entry.count += 1;
    if (Number.isFinite(t.season)) entry.seasons.push(t.season);
    map.set(key, entry);
  });
  return [...map.values()];
}

/** Datos de la tarjeta a partir de la carrera (puro, sin UI). */
export function shareData(career) {
  const stats = (career && career.careerStats) || {};
  const trophies = career && Array.isArray(career.trophies) ? career.trophies : [];
  const stints = career && Array.isArray(career.clubHistory) ? career.clubHistory : [];
  // Recorrido de clubes con su escudo (sin repetir pasos seguidos por el mismo).
  const visits = [...stints.map((stint) => stint && stint.club), career && career.club].filter(Boolean);
  const clubList = [];
  for (const club of visits) {
    const visual = reportClubVisual(club);
    if (clubList.length && clubList[clubList.length - 1].name === visual.name) continue;
    clubList.push(visual);
  }
  const names = clubList.map((club) => club.name);
  return {
    name: (career && career.name) || 'Jugador',
    photo: career && career.name ? photoOf(career.name) : null,
    position: career && career.position ? positionLabel(career.position) : DASH,
    ovr: safeNumber(career && career.ovr),
    peak: safeNumber(career && (career.overallPeak ?? career.ovr)),
    value: formatMoney(career && career.marketValue),
    valuePeak: formatMoney(Math.max(Number(career && career.marketValuePeak) || 0, Number(career && career.marketValue) || 0)),
    pj: safeNumber(stats.pj),
    gls: safeNumber(stats.gls),
    ast: safeNumber(stats.ast),
    titles: trophies.length,
    // Agrupadas por copa (en orden del primer título), con cuántas veces se ganó.
    trophyGroups: groupCups(trophies),
    clubs: names,
    clubList,
  };
}

/** Resumen en texto (para copiar o acompañar la imagen). */
export function shareText(data) {
  const clubs = data.clubs.length ? data.clubs.join(' → ') : 'sin club';
  return `Mi carrera en Averga's Club: ${data.name}, OVR máximo ${data.peak}. `
    + `${data.pj} partidos, ${data.gls} goles, ${data.ast} asistencias y ${data.titles} títulos. `
    + `Clubes: ${clubs}.`;
}

const loadImage = (src) => new Promise((resolve) => {
  if (!src) { resolve(null); return; }
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

/** Dibuja la tarjeta en un canvas 1080×1350 y devuelve un Blob PNG. */
export async function renderCard(data) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  try { await document.fonts.ready; } catch { /* sin Font Loading API */ }

  // Fondo nocturno cálido con halo ámbar (DESIGN.md).
  ctx.fillStyle = '#12130f';
  ctx.fillRect(0, 0, W, H);
  const halo = ctx.createRadialGradient(W * 0.85, 80, 0, W * 0.85, 80, 900);
  halo.addColorStop(0, 'rgba(231, 173, 78, 0.28)');
  halo.addColorStop(1, 'rgba(231, 173, 78, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  // Foto circular con aro ámbar.
  const photo = await loadImage(data.photo);
  const cx = W / 2;
  const cy = 300;
  const r = 190;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (photo) {
    const side = Math.min(photo.width, photo.height);
    ctx.drawImage(photo, (photo.width - side) / 2, (photo.height - side) * 0.2, side, side, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = '#0b0d08';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#e7ad4e';
    ctx.font = "700 150px 'Barlow Condensed', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.name.slice(0, 2).toUpperCase(), cx, cy + 6);
  }
  ctx.restore();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#e7ad4e';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f3f1eb';
  ctx.font = "700 110px 'Barlow Condensed', sans-serif";
  ctx.fillText(data.name.toUpperCase(), cx, 620);
  ctx.fillStyle = '#a6a89e';
  ctx.font = "500 40px 'DM Sans', sans-serif";
  ctx.fillText(`${data.position} · Valor máximo ${data.valuePeak} · final ${data.value}`, cx, 680);

  // OVR máximo (el final no se muestra: lo que cuenta es hasta dónde llegó).
  ctx.fillStyle = '#e7ad4e';
  ctx.font = "700 180px 'Barlow Condensed', sans-serif";
  ctx.fillText(String(data.peak), cx, 860);
  ctx.fillStyle = '#a6a89e';
  ctx.font = "600 36px 'DM Sans', sans-serif";
  ctx.fillText('OVR MÁXIMO', cx, 910);

  // Números.
  const cols = [['PJ', data.pj], ['GOLES', data.gls], ['ASIST.', data.ast], ['TÍTULOS', data.titles]];
  cols.forEach(([label, value], i) => {
    const x = 135 + i * 270;
    ctx.fillStyle = '#f3f1eb';
    ctx.font = "700 84px 'Barlow Condensed', sans-serif";
    ctx.fillText(String(value), x, 1050);
    ctx.fillStyle = '#a6a89e';
    ctx.font = "600 30px 'DM Sans', sans-serif";
    ctx.fillText(label, x, 1095);
  });

  // Copas ganadas: una por copa distinta, con "×N" si se ganó varias veces.
  if (data.trophyGroups.length) {
    const cups = await Promise.all(data.trophyGroups.map((g) => loadImage(trophyImage(g.trophy))));
    const m = data.trophyGroups.length;
    const slot = Math.min(130, (W - 120) / m);
    const ch = Math.min(56, slot * 0.5);
    data.trophyGroups.forEach((g, i) => {
      const x = cx - (m * slot) / 2 + i * slot + (slot - ch) / 2 - (g.count > 1 ? ch * 0.35 : 0);
      const img = cups[i];
      if (img) {
        const k = Math.min(ch / img.width, ch / img.height);
        ctx.drawImage(img, x + (ch - img.width * k) / 2, 1130 - img.height * k, img.width * k, img.height * k);
      } else {
        ctx.font = `${Math.round(ch * 0.8)}px sans-serif`;
        ctx.fillText(g.trophy.icon || '🏆', x + ch / 2, 1126);
      }
      if (g.count > 1) {
        ctx.fillStyle = '#e7ad4e';
        ctx.font = "700 34px 'Barlow Condensed', sans-serif";
        ctx.textAlign = 'left';
        ctx.fillText(`×${g.count}`, x + ch + 4, 1128);
        ctx.textAlign = 'center';
      }
    });
  }

  // Recorrido de clubes: los escudos en fila (si un club no tiene logo, su sigla).
  const crests = await Promise.all(data.clubList.map((club) => loadImage(club.crestSrc)));
  const n = Math.max(1, data.clubList.length);
  const size = Math.min(56, (W - 140 - (n - 1) * 18) / n);
  const startX = cx - (n * size + (n - 1) * 18) / 2;
  data.clubList.forEach((club, i) => {
    const x = startX + i * (size + 18);
    const y = 1160;
    const img = crests[i];
    if (img) {
      const k = Math.min(size / img.width, size / img.height);
      ctx.drawImage(img, x + (size - img.width * k) / 2, y + (size - img.height * k) / 2, img.width * k, img.height * k);
    } else {
      ctx.fillStyle = club.primary || '#3a3b33';
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f3f1eb';
      ctx.font = `700 ${Math.round(size * 0.4)}px 'Barlow Condensed', sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(String(club.short || '').slice(0, 3), x + size / 2, y + size / 2 + 2);
      ctx.textBaseline = 'alphabetic';
    }
  });

  ctx.fillStyle = '#e7ad4e';
  ctx.font = "700 40px 'Barlow Condensed', sans-serif";
  ctx.fillText("AVERGA'S CLUB · MI CARRERA", cx, 1290);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export default function CareerShareCard({ career }) {
  const data = shareData(career);
  const [status, setStatus] = useState('');

  const share = async () => {
    setStatus('Generando imagen…');
    try {
      const blob = await renderCard(data);
      const file = blob ? new File([blob], `carrera-${data.name.toLowerCase()}.png`, { type: 'image/png' }) : null;
      const text = shareText(data);
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
        setStatus('');
        return;
      }
      // Sin compartir archivos (ej. compu): descarga la imagen y copia el texto.
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      try { await navigator.clipboard.writeText(text); } catch { /* sin portapapeles */ }
      setStatus('Imagen descargada y resumen copiado.');
    } catch (error) {
      // Cancelar el menú de compartir no es un error para el usuario.
      setStatus(error && error.name === 'AbortError' ? '' : 'No se pudo compartir. Probá de nuevo.');
    }
  };

  return (
    <section className="career-share" aria-label="Tarjeta de la carrera">
      <div className="career-share-card">
        <span className="career-share-photo" aria-hidden="true">
          {data.photo ? <img src={data.photo} alt="" /> : data.name.slice(0, 2).toUpperCase()}
        </span>
        <strong className="career-share-name">{data.name}</strong>
        <span className="career-share-meta">{data.position}</span>
        <span className="career-share-meta">
          Valor máximo <b>{data.valuePeak}</b> · final {data.value}
        </span>
        <span className="career-share-ovr">{data.peak}</span>
        <span className="career-share-ovr-label">OVR máximo</span>
        <dl className="career-share-stats">
          <div><dd>{data.pj}</dd><dt>PJ</dt></div>
          <div><dd>{data.gls}</dd><dt>Goles</dt></div>
          <div><dd>{data.ast}</dd><dt>Asist.</dt></div>
          <div><dd>{data.titles}</dd><dt>Títulos</dt></div>
        </dl>
        {data.trophyGroups.length ? (
          <ol className="career-share-cups" aria-label="Títulos ganados">
            {data.trophyGroups.map(({ trophy, count, seasons }) => (
              <li key={trophy.trophyId || trophy.type || trophy.label} title={`${trophy.label}: ${seasons.join(' · ')}`}>
                <TrophyArt trophy={trophy} />
                {count > 1 ? <b className="career-cup-count">{`×${count}`}</b> : null}
              </li>
            ))}
          </ol>
        ) : null}
        {data.clubList.length ? (
          <ol className="career-share-clubs" aria-label="Clubes de la carrera">
            {data.clubList.map((club, i) => (
              <li key={`${club.name}-${i}`} title={club.name}>
                <ClubBadge club={club} size="xs" style={{ '--club-primary': club.primary, '--club-secondary': club.secondary }} />
              </li>
            ))}
          </ol>
        ) : <p className="career-share-clubs-empty">Sin club</p>}
      </div>
      <button type="button" className="career-button career-button--primary career-share-button" onClick={share}>
        <Share2 size={18} aria-hidden="true" /> Compartir carrera
      </button>
      {status ? <p className="career-section-note" role="status">{status}</p> : null}
    </section>
  );
}
