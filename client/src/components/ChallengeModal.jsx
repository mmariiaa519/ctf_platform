/**
 * @module ChallengeModal
 * @description Modal overlay for viewing a single CTF challenge and submitting a flag.
 *
 * This modal is opened when a participant clicks a row in the ChallengeList table.
 * It displays:
 * - Challenge metadata: category badge, title, point value, and full description.
 * - Flag input form (if not yet solved): a text input with monospace font
 *   for entering the flag in `F14G{...}` or `FLAG{...}` format.
 * - Feedback messages: green success banner or red error banner after submission.
 * - "Reto completado" (Challenge completed) banner if already solved.
 *
 * Interaction patterns:
 * - Submit flag via the form (Enter key or button click).
 * - Close via: Escape key, clicking the overlay backdrop, or the X close button.
 * - On wrong flag: the form shakes (CSS `.shake` animation) for 400ms, input clears
 *   and re-focuses for quick retry.
 * - On correct flag: success message shown, then auto-closes after 1.2s and
 *   triggers `onSolve` to refresh the challenge list.
 *
 * @see ChallengeList — the table component that triggers this modal via `onSelect`
 */

import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';

/**
 * @constant {Object<string, string>} CAT_COLORS
 * Maps challenge category keys to CSS custom property color values.
 * Duplicated from ChallengeCard.jsx because the modal renders its own
 * category badge independently. These correspond to the kill-chain phases
 * defined in the MARSEC Cyber Range exercise.
 */
const CAT_COLORS = {
  RECON: 'var(--cat-recon)', INTRUSION: 'var(--cat-intrusion)',
  FORENSICS: 'var(--cat-forensics)', SIGINT: 'var(--cat-sigint)',
  PRIVESC: 'var(--cat-privesc)', PERSISTENCE: 'var(--cat-persistence)',
  CRYPTO: 'var(--cat-crypto)',
};

/**
 * @constant {Object<string, string>} CAT_LABELS
 * Maps challenge category keys to human-readable Spanish labels.
 * Displayed inside the category badge at the top of the modal.
 */
const CAT_LABELS = {
  RECON: 'Reconocimiento', INTRUSION: 'Intrusion',
  FORENSICS: 'Analisis forense', SIGINT: 'Inteligencia',
  PRIVESC: 'Escalada de privilegios', PERSISTENCE: 'Persistencia',
  CRYPTO: 'Criptoanálisis',
};

/**
 * ChallengeModal
 * @description Full-screen overlay modal for flag submission on a single challenge.
 *
 * Lifecycle:
 * 1. On mount, auto-focuses the flag input (if challenge is not already solved).
 * 2. Registers a global `keydown` listener for Escape to close.
 * 3. On form submit, POSTs the flag to `/challenges/submit`.
 * 4. On correct flag: shows success message, waits 1.2s, calls `onSolve()`.
 * 5. On wrong flag: triggers shake animation, clears input, re-focuses.
 * 6. On unmount, cleans up the Escape key listener.
 *
 * @param {Object} props
 * @param {Object} props.challenge - The challenge object to display. Aliased as `c`.
 *   Must contain: id, title, description, category, points, solved.
 * @param {Function} props.onClose - Callback to close the modal (called on Escape,
 *   overlay click, or X button). Parent removes the modal from the DOM.
 * @param {Function} props.onSolve - Callback invoked after a correct flag submission
 *   (after the 1.2s success delay). Parent uses this to refresh challenge data.
 * @returns {JSX.Element} A full-viewport overlay containing the modal box.
 */
export default function ChallengeModal({ challenge: c, onClose, onSolve }) {
  /**
   * @state {string} flag - Current value of the flag input field.
   * Cleared on wrong submission to let the participant retry cleanly.
   */
  const [flag, setFlag] = useState('');

  /**
   * @state {Object|null} feedback - Feedback message shown after submission.
   * Shape: { type: 'success'|'error', msg: string }
   * null = no feedback visible (initial state or cleared).
   */
  const [feedback, setFeedback] = useState(null);

  /**
   * @state {boolean} loading - True while the flag submission API call is in-flight.
   * Disables the submit button and shows a spinner to prevent double-submit.
   */
  const [loading, setLoading] = useState(false);

  /**
   * @state {boolean} shaking - True during the 400ms shake animation on wrong flag.
   * When true, the form element gets the CSS class `.shake` which triggers
   * a horizontal shake keyframe animation defined in index.css.
   */
  const [shaking, setShaking] = useState(false);

  /**
   * Ref to the flag <input> element for programmatic focus control.
   * Auto-focused on mount (if unsolved) and re-focused after wrong submissions.
   */
  const inputRef = useRef(null);

  /**
   * Resolve the color for this challenge's category.
   * Used for the badge background, title accent, and point value display.
   */
  const color = CAT_COLORS[c.category] || 'var(--text-muted)';

  /**
   * Effect: auto-focus the flag input on mount.
   * Only focuses if the challenge is NOT already solved (no input to focus otherwise).
   * Dependency on `c.solved` ensures re-focus if the solved state somehow changes.
   */
  useEffect(() => { if (!c.solved) inputRef.current?.focus(); }, [c.solved]);

  /**
   * Effect: register a global keydown listener for Escape to close the modal.
   * This provides a standard UX pattern — pressing Escape dismisses the overlay.
   * Cleanup removes the listener to avoid memory leaks or stale closures.
   */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /**
   * submitFlag
   * @description Handles the flag submission form's `onSubmit` event.
   *
   * Flow:
   * 1. Prevent default form submission (page reload).
   * 2. Guard: skip if the input is empty/whitespace.
   * 3. POST to `/challenges/submit` with { challengeId, flag }.
   * 4. Server verifies the flag against the SHA256(salt + flag) hash stored
   *    in challenges.json and returns { correct: boolean, pointsAwarded?: number }.
   * 5a. If correct: show success feedback, then call `onSolve` after 1.2s delay
   *     to let the participant see the success message before the modal closes.
   * 5b. If incorrect: trigger shake animation (400ms), show error feedback,
   *     clear the input, and re-focus for quick retry.
   * 6. On network/server error: display the error message.
   *
   * @param {Event} e - Form submit event.
   */
  const submitFlag = async (e) => {
    e.preventDefault();
    if (!flag.trim()) return;
    setLoading(true);
    setFeedback(null);
    try {
      const data = await api.post('/challenges/submit', { challengeId: c.id, flag });
      if (data.correct) {
        /* Correct flag: show points awarded and schedule auto-close */
        setFeedback({ type: 'success', msg: `Flag correcta. +${data.pointsAwarded} puntos` });
        /* 1.2s delay gives the participant time to read the success message
           before the modal closes and the challenge list refreshes */
        setTimeout(onSolve, 1200);
      } else {
        /* Wrong flag: trigger the shake animation on the form */
        setShaking(true);
        setFeedback({ type: 'error', msg: 'Flag incorrecta. Revisa el formato e intentalo de nuevo.' });
        /* Remove the shake class after the CSS animation duration (400ms) */
        setTimeout(() => setShaking(false), 400);
        /* Clear the input and re-focus for immediate retry */
        setFlag('');
        inputRef.current?.focus();
      }
    } catch (e) {
      /* Network error or server-side exception — display the raw error message */
      setFeedback({ type: 'error', msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    /*
     * Overlay: full-viewport semi-transparent backdrop.
     * Clicking the overlay (but NOT the modal box) closes the modal.
     * The `.modal-overlay` class in index.css provides the dark backdrop,
     * centering (flexbox), and fade-in animation.
     */
    <div className="modal-overlay" onClick={onClose}>
      {/*
       * Modal box: the white-on-dark content container.
       * `stopPropagation` prevents clicks inside the box from triggering
       * the overlay's onClick (which would close the modal).
       */}
      <div className="modal-box" onClick={e => e.stopPropagation()}>

        {/* --- Header section: category badge, title, points, close button --- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            {/* Category badge: color-coded pill with Spanish category label */}
            <span
              className="badge"
              style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color, marginBottom: '0.5rem' }}
            >
              {CAT_LABELS[c.category] || c.category}
            </span>
            {/* Challenge title */}
            <h2 style={{ marginTop: '0.4rem', fontSize: '1.1rem' }}>{c.title}</h2>
            {/* Point value: monospace, bold, category-colored */}
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color, marginTop: '0.25rem', fontSize: '0.92rem' }}>
              {c.points} pts
            </div>
          </div>
          {/* Close button (X): top-right corner, minimal styling.
              aria-label "Cerrar" (Spanish for "Close") for accessibility. */}
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer',
              fontSize: '1.2rem', lineHeight: 1, padding: '0.25rem',
              flexShrink: 0,
            }}
            aria-label="Cerrar"
          >
            &#x2715;
          </button>
        </div>

        {/* --- Description section --- */}
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: '1.5rem' }}>
          {c.description}
        </p>

        {/* --- Feedback banner ---
            Conditionally rendered after a flag submission attempt.
            Uses `.msg-success` or `.msg-error` CSS classes for green/red styling. */}
        {feedback && (
          <div className={feedback.type === 'success' ? 'msg-success' : 'msg-error'}>
            {feedback.msg}
          </div>
        )}

        {/* --- Flag input form OR "completed" banner ---
            Conditional rendering based on whether the challenge is already solved. */}
        {!c.solved ? (
          /*
           * Flag submission form.
           * The `.shake` class is toggled on wrong submissions to trigger
           * the horizontal shake CSS keyframe animation (defined in index.css).
           */
          <form onSubmit={submitFlag} className={shaking ? 'shake' : ''}>
            <div style={{ marginBottom: '0.85rem' }}>
              {/* Label for the flag input */}
              <label>Dato de inteligencia</label>
              {/* Text input for flag entry.
                  - Monospace font (JetBrains Mono) for readability.
                  - Placeholder from challenge data hints at expected format.
                  - Ref used for programmatic focus on mount and after wrong attempts. */}
              <input
                ref={inputRef}
                value={flag}
                onChange={e => setFlag(e.target.value)}
                placeholder="Introduce el dato encontrado"
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.03em', fontSize: '0.95rem' }}
              />
            </div>
            {/* Submit button: full-width, disabled while loading or if input is empty.
                Shows a spinner during API call, otherwise "Enviar flag" (Submit flag). */}
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.65rem' }}
              disabled={loading || !flag.trim()}
            >
              {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Enviar'}
            </button>
          </form>
        ) : (
          /*
           * "Reto completado" (Challenge completed) banner.
           * Shown when the challenge has already been solved by this team.
           * Green-tinted background with success border, centered text.
           */
          <div style={{
            textAlign: 'center', padding: '1rem',
            color: 'var(--success)', fontWeight: 600,
            background: 'rgba(39,174,96,0.07)',
            border: '1px solid rgba(39,174,96,0.25)',
            borderRadius: 'var(--radius)',
          }}>
            Reto completado
          </div>
        )}
      </div>
    </div>
  );
}
