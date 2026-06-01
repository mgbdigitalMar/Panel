import { motion, AnimatePresence } from 'framer-motion';
import { Check, CheckCircle } from 'lucide-react';
import { Button } from './ui';

export function PolicyModal({
  user,
  policyAccepted,
  policyTimer,
  policyRead,
  setPolicyRead,
  onboardingDocUrl,
  setCurrentUser
}) {
  return (
    <AnimatePresence>
      {user && policyAccepted !== true && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.88)',
            zIndex: 'var(--z-toast)',
            display: 'flex',
            flexDirection: 'column',
            padding: 'clamp(12px, 3vw, 24px)',
            backdropFilter: 'blur(8px)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Lectura obligatoria"
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              backgroundColor: 'var(--bg)',
              borderRadius: 'var(--radius-xl)',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-2xl)',
              maxWidth: 900,
              margin: '0 auto',
              width: '100%',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
              <h2 style={{ margin: 0, fontSize: 'clamp(16px,2vw,20px)', color: 'var(--text)', letterSpacing: '-0.03em' }}>
                Lectura Obligatoria
              </h2>
              <p style={{ margin: '6px 0 0', color: 'var(--text-sec)', fontSize: 13, lineHeight: 1.6 }}>
                Es obligatorio leer y aceptar el <strong>Procedimiento de Normas Internas 2026</strong> para continuar.
              </p>
            </div>
            <div style={{ flex: 1, background: '#f5f5f5', position: 'relative' }}>
              <iframe
                src={onboardingDocUrl ? `${onboardingDocUrl}#toolbar=0` : "/Procedimiento normas internas 2026.pdf#toolbar=0"}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                title="Procedimiento de normas internas"
              />
            </div>
            <div style={{
              padding: '18px 24px',
              borderTop: '1px solid var(--border)',
              background: 'var(--card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: policyTimer === 0 ? 'pointer' : 'not-allowed', opacity: policyTimer === 0 ? 1 : 0.6, userSelect: 'none' }}>
                <div style={{ position: 'relative', width: 22, height: 22 }}>
                  <input
                    type="checkbox"
                    disabled={policyTimer > 0}
                    checked={policyRead}
                    onChange={e => setPolicyRead(e.target.checked)}
                    style={{ position: 'absolute', opacity: 0, cursor: policyTimer === 0 ? 'pointer' : 'not-allowed', width: '100%', height: '100%', margin: 0, zIndex: 2 }}
                    role="checkbox"
                    aria-checked={policyRead}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: policyRead ? 'var(--accent)' : 'var(--bg)',
                    border: policyRead ? '2px solid var(--accent)' : '2px solid var(--border)',
                    borderRadius: '6px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                    boxShadow: policyRead ? '0 2px 8px rgba(34,81,255,0.3)' : 'none',
                    zIndex: 1
                  }}>
                    <Check size={14} color="#fff" strokeWidth={3} style={{ opacity: policyRead ? 1 : 0, transform: policyRead ? 'scale(1)' : 'scale(0.5)', transition: 'all 0.2s' }} />
                  </div>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: policyRead ? 'var(--text)' : 'var(--text-sec)', transition: 'color 0.2s' }}>
                  Confirmo que he leído el documento hasta el final
                </span>
              </label>
              <Button
                variant="primary"
                size="lg"
                icon={CheckCircle}
                disabled={!policyRead || policyTimer > 0}
                onClick={() => setCurrentUser({ id: user.id, policyAccepted: true })}
              >
                {policyTimer > 0 ? `Espera ${policyTimer}s...` : 'Confirmar lectura'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
