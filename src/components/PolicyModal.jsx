import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, PenLine, ArrowLeft, FileText } from 'lucide-react';
import { Button, Input } from './ui';
import { SignaturePad } from './SignaturePad';
import { supabase } from '../utils/supabase';
import { POLICY_TITLE, isSignatureComplete, signInternalPolicy } from '../../shared/services/policy.js';
import { toUserMessage } from '../../shared/utils/errors.js';
import styles from './PolicyModal.module.scss';

const DEFAULT_PDF = '/Procedimiento normas internas 2026.pdf';

/** Ticks drawn like the existing "read" checkbox */
function CheckBox({ checked, disabled, onChange, children }) {
  return (
    <label className={styles.check} data-disabled={disabled || undefined}>
      <span className={styles.box} data-checked={checked || undefined}>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <Check size={14} color="#fff" strokeWidth={3} aria-hidden="true" />
      </span>
      <span className={styles.checkText}>{children}</span>
    </label>
  );
}

/**
 * Blocks the app until the internal rules are read and signed. Step 1: read the document
 * (at least `policyTimer` seconds). Step 2: full name, acceptance and a drawn signature,
 * saved by sign_internal_policy() with the server's date.
 */
export function PolicyModal({
  user,
  policyAccepted,
  policyTimer,
  policyRead,
  setPolicyRead,
  onboardingDocUrl,
  onSigned,
}) {
  const [step, setStep] = useState('read');
  const [name, setName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // New person or rules marked pending again: start over
  useEffect(() => {
    if (user && policyAccepted !== true) {
      setStep('read');
      setName(user.name || '');
      setAccepted(false);
      setStrokes([]);
      setError('');
    }
  }, [user?.id, policyAccepted]);

  // Inside the document iframe (an outdated service worker can answer the PDF
  // request with the app itself): never nest the modal again.
  if (typeof window !== 'undefined' && window.self !== window.top) return null;

  const docUrl = onboardingDocUrl || DEFAULT_PDF;
  const signatureDone = isSignatureComplete(strokes);
  const canSign = name.trim().length >= 3 && accepted && signatureDone && !saving;

  const sign = async () => {
    if (!canSign) return;
    setSaving(true);
    setError('');
    const res = await signInternalPolicy(supabase, {
      signerName: name.trim(),
      strokes,
      documentTitle: POLICY_TITLE,
      documentUrl: docUrl,
      platform: 'web',
      userAgent: navigator.userAgent,
    });
    setSaving(false);
    if (res.error) {
      setError(toUserMessage(res.error, 'No se ha podido guardar la firma. Inténtalo de nuevo.'));
      return;
    }
    onSigned?.(res.signedAt);
  };

  return (
    <AnimatePresence>
      {user && policyAccepted !== true && (
        <div className={styles.scrim} role="dialog" aria-modal="true" aria-labelledby="policy-title" data-scrim>
          <motion.div
            className={styles.sheet}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className={styles.head}>
              <p className={styles.steps} aria-label={`Paso ${step === 'read' ? 1 : 2} de 2`}>
                <span data-on={step === 'read' || undefined}>1 · Leer</span>
                <span data-on={step === 'sign' || undefined}>2 · Firmar</span>
              </p>
              <h2 id="policy-title" className={styles.title}>
                {step === 'read' ? 'Lectura obligatoria' : 'Firma de las normas internas'}
              </h2>
              <p className={styles.desc}>
                {step === 'read'
                  ? <>Para continuar debes leer y firmar el <strong>{POLICY_TITLE}</strong>.</>
                  : <>Tu firma queda registrada con la fecha y RRHH podrá consultarla.</>}
              </p>
            </div>

            {step === 'read' ? (
              <div className={styles.docArea}>
                <iframe src={`${docUrl}#toolbar=0`} className={styles.iframe} title={POLICY_TITLE} />
              </div>
            ) : (
              <div className={styles.signArea}>
                <div className={styles.signInner}>
                  <div className={styles.docRow}>
                    <FileText size={18} aria-hidden="true" />
                    <span>Vas a firmar: <strong>{POLICY_TITLE}</strong></span>
                    <button type="button" className={styles.backLink} onClick={() => setStep('read')}>
                      <ArrowLeft size={14} aria-hidden="true" /> Volver al documento
                    </button>
                  </div>

                  <Input
                    id="policy-signer"
                    label="Nombre y apellidos"
                    value={name}
                    onChange={setName}
                    required
                    autoComplete="name"
                    showValidationIcon={false}
                  />

                  <div className={styles.field}>
                    <p id="policy-signature-label" className={styles.fieldLabel}>Firma <span aria-hidden="true">*</span></p>
                    <SignaturePad onChange={setStrokes} disabled={saving} labelledBy="policy-signature-label" />
                    {strokes.length > 0 && !signatureDone && (
                      <p className={styles.hint}>La firma es muy corta: firma como lo harías en papel.</p>
                    )}
                  </div>

                  <CheckBox checked={accepted} onChange={setAccepted} disabled={saving}>
                    He leído y acepto el {POLICY_TITLE}.
                  </CheckBox>

                  <p className={styles.legal}>
                    Se guardarán tu nombre, tu firma, la fecha y hora, el documento y el dispositivo desde el que firmas.
                    Solo tú y RRHH podéis verla.
                  </p>

                  {error && <p className={styles.error} role="alert">{error}</p>}
                </div>
              </div>
            )}

            <div className={styles.foot}>
              {step === 'read' ? (
                <>
                  <CheckBox checked={policyRead} onChange={setPolicyRead} disabled={policyTimer > 0}>
                    Confirmo que he leído el documento hasta el final
                  </CheckBox>
                  <Button
                    variant="primary"
                    size="lg"
                    icon={PenLine}
                    disabled={!policyRead || policyTimer > 0}
                    onClick={() => setStep('sign')}
                  >
                    {policyTimer > 0 ? `Espera ${policyTimer}s...` : 'Continuar a la firma'}
                  </Button>
                </>
              ) : (
                <>
                  <span className={styles.footNote}>
                    {!signatureDone ? 'Falta tu firma' : !accepted ? 'Marca la casilla de aceptación' : name.trim().length < 3 ? 'Escribe tu nombre completo' : 'Todo listo'}
                  </span>
                  <Button variant="primary" size="lg" icon={Check} disabled={!canSign} loading={saving} onClick={sign}>
                    Firmar y aceptar
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
