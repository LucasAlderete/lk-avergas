// ============================================================================
// BOTÓN DE RESET DEL VOTO — "Borrar mi voto" para empezar de cero.
//
// Aparece sólo si esta persona ya gastó puntos, y pide confirmación en dos
// toques (Sin/Cancelar) en vez de usar window.confirm: en el celu el diálogo
// nativo se ve fuera de tema y en algunos navegadores embebidos no aparece.
//
// Importante: borra SÓLO la boleta local de este navegador. Los votos que ya
// aplicaste desde los informes de WhatsApp van en el bundle y los ve todo el
// mundo: acá no se tocan.
// ============================================================================
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

import { spent as spentOf } from './voteRules.js';

export default function ResetVoteButton({ myBallot, onReset }) {
  const [asking, setAsking] = useState(false);
  const used = spentOf(myBallot);

  // Todavía no votó: no hay nada que borrar, así que ni se muestra.
  if (used === 0) return null;

  if (!asking) {
    return (
      <button type="button" className="vote-reset" onClick={() => setAsking(true)}>
        <RotateCcw size={14} aria-hidden="true" />
        Borrar mi voto
      </button>
    );
  }

  // Al confirmar, `onReset` deja la boleta vacía y este componente se desmonta
  // solo (used vuelve a 0), así que no hace falta limpiar el estado a mano.
  return (
    <span className="vote-reset-confirm" role="alert">
      <b>¿Borrar tus {used} {used === 1 ? 'punto' : 'puntos'}?</b>
      <button type="button" className="is-yes" onClick={onReset}>Sí</button>
      <button type="button" onClick={() => setAsking(false)}>No</button>
    </span>
  );
}