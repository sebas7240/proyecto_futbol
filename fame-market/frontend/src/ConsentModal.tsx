import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { ConsentStatus } from './types';

export function ConsentModal({
  consent,
  pending,
  onAccept
}: {
  consent: ConsentStatus;
  pending: boolean;
  onAccept: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="consent-backdrop" role="presentation">
      <section
        className="consent-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
      >
        <span className="consent-modal__icon">
          <ShieldCheck size={21} />
        </span>
        <small>Beta cerrada</small>
        <h2 id="consent-title">Antes de realizar tu primera operacion</h2>
        <p>
          Fame Market es un juego con monedas y participaciones ficticias. No es
          una inversion, no permite retiros y no promete premios.
        </p>
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>
            He leido y acepto las{' '}
            <a href="/reglas" target="_blank" rel="noreferrer">
              reglas
            </a>{' '}
            y la{' '}
            <a href="/privacidad" target="_blank" rel="noreferrer">
              politica de privacidad
            </a>
            .
          </span>
        </label>
        <button onClick={onAccept} disabled={!confirmed || pending}>
          {pending ? 'Registrando...' : 'Aceptar y entrar al mercado'}
        </button>
        <small className="consent-modal__version">
          Reglas {consent.rulesVersion} | Privacidad {consent.privacyVersion}
        </small>
      </section>
    </div>
  );
}
