import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Portal } from '../components/ui/Portal/Portal';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useRequests, useReservations, usePersonalDays, useDataSync } from './index';
import AssistantConversation from '../components/AssistantConversation';
import { supabase } from '../utils/supabase';
import { useAssistantConversation } from '../../shared/hooks/useAssistantConversation.js';
import styles from '../pages/AssistantPage.module.scss';

const AssistantContext = createContext(null);
export const useAssistant = () => useContext(AssistantContext);
const getAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token;
};

function Session({ children, user }) {
  const [open, setOpen] = useState(false);
  const [keyboardStyle, setKeyboardStyle] = useState(undefined);
  const launcher = useRef(null);
  const panel = useRef(null);
  const close = useCallback(() => { setOpen(false); launcher.current?.focus(); }, []);
  const openAssistant = useCallback(() => setOpen(true), []);
  useEffect(() => {
    if (open) panel.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = event => {
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('[aria-modal="true"]')) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!open || !viewport) return;
    const update = () => setKeyboardStyle(window.innerHeight - viewport.height > 120
      ? { top: viewport.offsetTop + 12, bottom: 'auto', height: Math.max(180, Math.min(560, viewport.height - 24)) }
      : undefined);
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => { viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update); };
  }, [open]);
  const requestData = useRequests();
  const reservationData = useReservations();
  const dayData = usePersonalDays();
  const { loadingData, loadFailed } = useDataSync();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const conversation = useAssistantConversation({ context: { user, ...requestData, ...reservationData, ...dayData }, getAccessToken, loadingData, loadFailed });
  const allowed = user && user.firstLogin !== true && user.firstLogin !== 'true' && user.policyAccepted === true && !['/login', '/changePassword'].includes(pathname);
  return <AssistantContext.Provider value={{ openAssistant }}>
    {children}
    {allowed && <>
      <button ref={launcher} type="button" className={styles.launcher} onClick={open ? close : openAssistant} aria-label={open ? 'Minimizar asistente' : 'Abrir asistente'} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? 'margube-assistant' : undefined}>
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" aria-hidden="true"><path d="M9.5 39.5C9.5 22 14.5 10 25 9.2L39.5 8.8V24C39.5 34 33 39.5 24 39.5Z"/><path d="M10.5 38.5C12.5 31 16.5 26.8 22 24" strokeLinecap="round"/></svg>
      </button>
      {open && <Portal><section ref={panel} id="margube-assistant" tabIndex={-1} role="dialog" aria-label="Asistente Margube" style={keyboardStyle} className={`${styles.window} glass-scope`} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
        <AssistantConversation conversation={conversation} user={user} loadingData={loadingData} loadFailed={loadFailed} onClose={close} go={path => { close(); navigate(path); }} />
      </section></Portal>}
    </>}
  </AssistantContext.Provider>;
}

export function AssistantProvider({ children }) {
  const { user } = useAuth();
  return <Session key={user?.id || 'guest'} user={user}>{children}</Session>;
}
