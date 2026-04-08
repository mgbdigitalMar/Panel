import { useState } from 'react';
import { useAuth } from '../context';
import { Sparkles, CalendarCheck, BellRing, Rocket, UsersRound } from 'lucide-react';
import { Button } from './ui';
import styles from './OnboardingModal.module.scss';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const SLIDES = [
  {
    icon: Sparkles,
    title: '¡Bienvenido a Margube!',
    desc: 'Tu nueva intranet corporativa. Todo lo que necesitas para tu día a día está a un clic. Este tour rápido te enseñará lo esencial en 30 segundos.'
  },
  {
    icon: CalendarCheck,
    title: 'Reservas y solicitudes',
    desc: 'Desde el menú lateral reserva salas de reuniones y vehículos, o solicita vacaciones y compras. El nuevo Calendario visual te muestra la ocupación por día y semana de un vistazo.'
  },
  {
    icon: UsersRound,
    title: 'El equipo, siempre visible',
    desc: 'En la sección "Equipo" verás a todos tus compañeros, su disponibilidad (presencial, remoto o externo) y podrás actualizar tu propio estado en tiempo real.'
  },
  {
    icon: BellRing,
    title: 'Notificaciones instantáneas',
    desc: 'La campana en la barra superior te avisa cuando tienes solicitudes pendientes o reservas confirmadas. Márcalas como leídas con un solo clic.'
  },
  {
    icon: Rocket,
    title: '¡Todo listo!',
    desc: 'Tu cuenta está activa y segura. Explora la intranet con confianza. Si necesitas ayuda, contacta con RRHH.'
  }
];

export default function OnboardingModal() {
  const { setNeedsOnboarding } = useAuth();
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < SLIDES.length - 1) setStep(s => s + 1);
    else setNeedsOnboarding(false);
  };

  const progress = ((step + 1) / SLIDES.length) * 100;

  return (
    <div className={styles.overlay}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 24 }}
        className={styles.modalContent}
      >
        {/* Progress bar */}
        <div className={styles.progressBar}>
          <motion.div
            className={styles.progressFill}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className={styles.slidesContainer}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className={styles.slide}
            >
              {(() => {
                const Icon = SLIDES[step].icon;
                return (
                  <>
                    <div className={styles.iconWrapper}>
                      <Icon size={34} />
                    </div>
                    <h2 className={styles.title}>{SLIDES[step].title}</h2>
                    <p className={styles.desc}>{SLIDES[step].desc}</p>
                  </>
                );
              })()}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className={styles.footer}>
          <div className={styles.dots}>
            {SLIDES.map((_, i) => (
              <div key={i} className={clsx(styles.dot, { [styles.dotActive]: step === i })} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {step < SLIDES.length - 1 && (
              <button className={styles.skipBtn} onClick={() => setNeedsOnboarding(false)}>
                Saltar
              </button>
            )}
            <Button onClick={handleNext}>
              {step === SLIDES.length - 1 ? '¡Empezar!' : 'Siguiente →'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
