// All intranet data for the app, kept in sync like the web DataProvider:
// same tables, same realtime channels, same write rules (via ../shared/services),
// plus a full refetch whenever the app returns to the foreground.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as svc from '@shared/services/index.js';
import { REALTIME_CHANNELS } from '@shared/config/constants.js';
import { logError } from '@shared/utils/errors.js';
import { supabase } from '../lib/supabase';
import { hashPassword } from '../lib/bcrypt';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { setBadgeCount } from '../services/pushNotifications';
import { todayISO, initials } from '../utils/format';

const DataCtx = createContext(null);

export const ONBOARDING_DOC_TITLE = '__ONBOARDING_DOC__';


export function DataProvider({ children }) {
  const { user, employees, refreshEmployees, setUser } = useAuth();
  const toast = useToast();

  const [requests, setRequests] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [hourCompensations, setHours] = useState([]);
  const [personalDays, setPersonalDays] = useState([]);
  const [news, setNews] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loadedFor, setLoadedFor] = useState(null); // user id whose data is loaded
  const [lastSync, setLastSync] = useState(null);

  const userRef = useRef(user);
  const employeesRef = useRef(employees);
  const requestsRef = useRef(requests);
  useEffect(() => { userRef.current = user; employeesRef.current = employees; }, [user, employees]);
  useEffect(() => { requestsRef.current = requests; }, [requests]);

  // ── fetchers ────────────────────────────────────────────────────
  // Employees only load their own requests and personal days (with their
  // supporting documents); admins load everyone's.
  const ownScope = () => {
    const me = userRef.current;
    return me?.role === 'admin' ? {} : { employeeId: me?.id };
  };
  const loadRequests = useCallback(async () => {
    if (!userRef.current?.id) return setRequests([]);
    setRequests(await svc.fetchRequests(supabase, ownScope()));
  }, []);
  const loadReservations = useCallback(async () => setReservations(await svc.fetchReservations(supabase)), []);
  const loadRooms = useCallback(async () => setRooms(await svc.fetchRooms(supabase)), []);
  const loadVehicles = useCallback(async () => setVehicles(await svc.fetchVehicles(supabase)), []);
  const loadDocuments = useCallback(async () => setDocuments(await svc.fetchDocuments(supabase)), []);
  const loadHours = useCallback(async () => setHours(await svc.fetchHourCompensations(supabase)), []);
  const loadPersonalDays = useCallback(async () => {
    if (!userRef.current?.id) return setPersonalDays([]);
    setPersonalDays(await svc.fetchPersonalDays(supabase, ownScope()));
  }, []);
  const loadNews = useCallback(async () => setNews(await svc.fetchNews(supabase)), []);
  const loadNotifications = useCallback(async () => {
    const id = userRef.current?.id;
    setNotifications(id ? await svc.fetchNotifications(supabase, id) : []);
  }, []);

  const refetchAll = useCallback(async () => {
    await Promise.all([
      loadRequests(), loadReservations(), loadRooms(), loadVehicles(), loadDocuments(),
      loadHours(), loadPersonalDays(), loadNews(), loadNotifications(),
    ]);
    setLastSync(new Date());
  }, [loadRequests, loadReservations, loadRooms, loadVehicles, loadDocuments, loadHours, loadPersonalDays, loadNews, loadNotifications]);

  // ── initial load + realtime (mirrors the web channels and toasts) ──
  useEffect(() => {
    if (!user?.id) return undefined;
    const loadingId = user.id;
    // Every setState inside refetchAll runs after an await (async fetch), not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refetchAll().finally(() => setLoadedFor(loadingId));

    const me = () => userRef.current;
    const isAdmin = () => me()?.role === 'admin';
    const notify = (title, tone = 'info') => toast.show({ title, tone });
    const ch = (name, table, handler, event = '*') => supabase
      .channel(name)
      .on('postgres_changes', { event, schema: 'public', table }, handler)
      .subscribe();

    const channels = [
      ch(REALTIME_CHANNELS.requests, 'requests', (p) => {
        loadRequests();
        if (p.eventType === 'INSERT' && p.new.employee_id !== me()?.id && isAdmin()) notify('📋 Nueva solicitud recibida');
        if (p.eventType === 'UPDATE' && p.new.employee_id === me()?.id) {
          if (p.new.status === 'approved') notify('Una solicitud ha sido aprobada', 'success');
          if (p.new.status === 'rejected') notify('Una solicitud ha sido rechazada', 'error');
        }
      }),
      ch(REALTIME_CHANNELS.reservations, 'reservations', (p) => {
        loadReservations();
        if (p.eventType === 'INSERT' && p.new.employee_id !== me()?.id && isAdmin()) notify('📅 Nueva reserva pendiente de revisión');
        if (p.eventType === 'UPDATE' && p.new.employee_id === me()?.id) {
          if (p.new.status === 'confirmed') notify('Tu reserva ha sido confirmada', 'success');
          if (p.new.status === 'cancelled') notify('Tu reserva ha sido cancelada', 'error');
        }
      }),
      ch(REALTIME_CHANNELS.rooms, 'rooms', () => loadRooms()),
      ch(REALTIME_CHANNELS.vehicles, 'vehicles', () => loadVehicles()),
      ch(REALTIME_CHANNELS.documents, 'documents', (p) => {
        loadDocuments();
        if (p.eventType === 'INSERT' && p.new.sender_id !== me()?.id && p.new.recipient_id === me()?.id) {
          notify(`📄 Nuevo documento: ${p.new.title || ''}`);
        }
      }),
      ch(REALTIME_CHANNELS.hours, 'hour_compensations', (p) => {
        loadHours();
        if (p.eventType === 'UPDATE' && p.new.employee_id === me()?.id) {
          if (p.new.status === 'approved') notify('Tu bolsa de horas ha sido aprobada', 'success');
          if (p.new.status === 'rejected') notify('Tu bolsa de horas ha sido rechazada', 'error');
        }
      }),
      ch(REALTIME_CHANNELS.personalDays, 'personal_days', (p) => {
        loadPersonalDays();
        if (p.eventType === 'INSERT' && p.new.employee_id !== me()?.id && isAdmin()) notify('📝 Nueva solicitud de asuntos propios');
        if (p.eventType === 'UPDATE' && p.new.employee_id === me()?.id) {
          if (p.new.status === 'approved') notify('Asuntos propios aprobados', 'success');
          if (p.new.status === 'rejected') notify('Asuntos propios rechazados', 'error');
        }
      }),
      ch(REALTIME_CHANNELS.news, 'news', () => loadNews()),
      supabase
        .channel(REALTIME_CHANNELS.notifications)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (p) => {
          if (p.new.user_id !== me()?.id) return;
          setNotifications((prev) => [p.new, ...prev.filter((n) => n.id !== p.new.id)].slice(0, 50));
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (p) => {
          if (p.new.user_id !== me()?.id) return;
          setNotifications((prev) => prev.map((n) => (n.id === p.new.id ? p.new : n)));
        })
        .subscribe(),
    ];

    // Equivalent of the web's visibilitychange refetch.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refetchAll();
    });

    return () => {
      sub.remove();
      channels.forEach((c) => supabase.removeChannel(c));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadingData = !!user?.id && loadedFor !== user.id;

  // App icon badge = unread notifications.
  // Only this user's rows (a previous session's list may linger until the refetch lands).
  const myNotifications = useMemo(() => notifications.filter((n) => n.user_id === user?.id), [notifications, user?.id]);
  const unreadCount = useMemo(() => myNotifications.filter((n) => !n.read).length, [myNotifications]);
  useEffect(() => { if (user?.id) setBadgeCount(unreadCount); }, [unreadCount, user?.id]);

  // ── work mode sync (same rule as the web, see shared/services/workMode.js) ──
  const syncingMode = useRef(null);
  useEffect(() => {
    if (!user?.id || loadingData) return;
    const update = svc.workModeSyncUpdate(requests, user);
    const key = update && JSON.stringify(update);
    if (!update || syncingMode.current === key) return;
    syncingMode.current = key;
    supabase.from('profiles').update(update).eq('id', user.id).then(({ error }) => {
      if (error) logError('syncWorkMode', error);
      // The profiles realtime event refreshes `user`; refresh anyway in case it is missed
      refreshEmployees();
      setUser((prev) => (prev && !error ? {
        ...prev,
        ...(update.work_mode && { workMode: update.work_mode }),
        ...(update.telework_applied_on && { teleworkAppliedOn: update.telework_applied_on }),
      } : prev));
      syncingMode.current = null;
    });
  }, [user, requests, loadingData, refreshEmployees, setUser]);

  // ── writes: employee features ─────────────────────────────────
  const emps = () => employeesRef.current;
  const uid = () => userRef.current?.id;

  const actions = useMemo(() => ({
    // Notifications
    markNotifRead: async (id) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      await svc.markNotifRead(supabase, id);
    },
    markAllNotifsRead: async () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      await svc.markAllNotifsRead(supabase, uid());
    },

    // Requests + personal days
    createRequest: async (payload) => {
      const res = await svc.createRequest(supabase, emps(), uid(), payload);
      if (!res.error) await loadRequests();
      return res;
    },
    createPersonalDay: async ({ date, reason, fileUrl }) => {
      const res = await svc.createPersonalDay(supabase, emps(), { employeeId: uid(), date, reason, fileUrl });
      if (!res.error) await loadPersonalDays();
      return res;
    },
    setRequestStatus: async (item, status) => {
      const res = item.type === 'asuntos_propios'
        ? await svc.updatePersonalDayStatus(supabase, item.id, status, uid(), item.employeeId)
        : await svc.updateRequestStatus(supabase, emps(), item.id, status, uid(), item.employeeId);
      await (item.type === 'asuntos_propios' ? loadPersonalDays() : loadRequests());
      return res || { error: null };
    },
    deleteRequest: async (item) => {
      const res = item.type === 'asuntos_propios'
        ? await svc.deletePersonalDay(supabase, item.id, item.fileUrl)
        : await svc.deleteRequest(supabase, item.id);
      await (item.type === 'asuntos_propios' ? loadPersonalDays() : loadRequests());
      return res;
    },

    // Reservations
    createReservation: async (payload) => {
      const res = await svc.createReservation(supabase, emps(), rooms, vehicles, uid(), payload);
      if (!res.error) await loadReservations();
      return res;
    },
    setReservationStatus: async (id, status) => {
      const res = await svc.updateReservationStatus(supabase, id, status, uid());
      await loadReservations();
      return res;
    },
    deleteReservation: async (id) => {
      const res = await svc.deleteReservation(supabase, id);
      await loadReservations();
      return res;
    },

    // Hours
    createHourCompensation: async ({ date, reason, hours, type }) => {
      const res = await svc.createHourCompensation(supabase, emps(), { employeeId: uid(), date, reason, hours, type });
      if (!res.error) await loadHours();
      return res;
    },
    setHourStatus: async (entry, status) => {
      const res = await svc.updateHourCompensationStatus(supabase, entry.id, status, uid(), entry.employeeId);
      await loadHours();
      return res;
    },
    deleteHourCompensation: async (id) => {
      const res = await svc.deleteHourCompensation(supabase, id);
      await loadHours();
      return res;
    },

    // Documents
    updateDocumentStatus: async (id, status) => {
      const res = await svc.updateDocumentStatus(supabase, id, status);
      await loadDocuments();
      return res || { error: null };
    },
    sendDocument: async ({ title, description, fileUrl, recipientId }) => {
      const res = await svc.sendDocument(supabase, { title, description, fileUrl, senderId: uid(), recipientId });
      await loadDocuments();
      return res;
    },
    deleteDocument: async (doc) => {
      const res = await svc.deleteDocument(supabase, doc.id, doc.fileUrl);
      await loadDocuments();
      return res || { error: null };
    },
    setOnboardingDocument: async (fileUrl) => {
      const { error } = await supabase.from('documents').insert([{
        title: ONBOARDING_DOC_TITLE,
        description: 'Documento de inicio dinámico',
        file_url: fileUrl,
        sender_id: uid(),
        recipient_id: null,
        status: 'completed',
      }]);
      await loadDocuments();
      return { error };
    },

    // News
    saveNews: async (id, form) => {
      const payload = { title: form.title, content: form.content, type: form.type, category: form.category, pinned: form.pinned };
      const res = id
        ? await svc.updateNews(supabase, id, payload)
        : await svc.createNews(supabase, { ...payload, author_id: uid(), published_at: todayISO() });
      await loadNews();
      return res || { error: null };
    },
    deleteNews: async (id) => {
      const res = await svc.deleteNews(supabase, id);
      await loadNews();
      return res || { error: null };
    },

    // Work mode of any employee (admin) or self — EmployeesPage / ProfilePage on the web.
    // Going back to the office ends the active request early and notifies the admins.
    setWorkMode: async (employeeId, mode) => {
      const employee = emps().find((e) => e.id === employeeId)
        || (userRef.current?.id === employeeId ? userRef.current : { id: employeeId });
      const res = await svc.changeWorkMode(supabase, emps(), { employee, mode, requests: requestsRef.current, actorId: uid() });
      if (!res.error && employeeId === uid()) setUser((prev) => (prev ? { ...prev, workMode: mode } : prev));
      await Promise.all([refreshEmployees(), loadRequests()]);
      return res;
    },

    // ── admin: employees (AdminPage) ──
    saveEmployee: async (existing, form) => {
      const base = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        department: form.dept,
        position: form.position || null,
        phone: form.phone || null,
        birthdate: form.birthdate || null,
        avatar_initials: initials(form.name),
        policy_accepted: form.policyAccepted === true,
      };
      // Telework schedule (same rule as the web AdminPage): only sent when it
      // changes, so the form keeps working before the telework migration is run.
      const days = [...(form.teleworkDays || [])].sort();
      const daysChanged = days.join() !== [...(existing?.teleworkDays || [])].sort().join();
      let error;
      if (existing) {
        const update = { ...base, work_mode: form.workMode || 'Office' };
        if (daysChanged) {
          update.telework_days = days;
          if (update.work_mode === (existing.workMode || 'Office')) {
            // Apply the new schedule to today right away
            Object.assign(update, svc.teleworkScheduleUpdate(requestsRef.current, { ...existing, teleworkDays: days, teleworkAppliedOn: null }));
          } else {
            // The admin also picked today's mode by hand: keep it for today
            update.telework_applied_on = svc.localISODate();
          }
        }
        if (form.password) {
          update.password_hash = await hashPassword(form.password);
          update.first_login = true;
        }
        ({ error } = await supabase.from('profiles').update(update).eq('id', existing.id));
      } else {
        const hash = await hashPassword(form.password);
        const schedule = days.length
          ? { telework_days: days, ...svc.teleworkScheduleUpdate([], { id: 'new', teleworkDays: days, workMode: 'Office' }) }
          : {};
        ({ error } = await supabase.from('profiles').insert([{ ...base, ...schedule, password_hash: hash, first_login: true }]));
      }
      await refreshEmployees();
      return { error };
    },
    resetEmployeePassword: async (employeeId, tempPassword) => {
      const hash = await hashPassword(tempPassword);
      const { error } = await supabase.from('profiles').update({ password_hash: hash, first_login: true }).eq('id', employeeId);
      await refreshEmployees();
      return { error };
    },
    deleteEmployee: async (employeeId) => {
      // Same cleanup as the web: remove the employee's stored files first.
      for (const d of documents.filter((x) => String(x.senderId) === String(employeeId) || String(x.recipientId) === String(employeeId))) {
        await svc.removeStorageFile(supabase, d.fileUrl);
      }
      for (const p of personalDays.filter((x) => String(x.employeeId) === String(employeeId))) {
        await svc.removeStorageFile(supabase, p.fileUrl);
      }
      const { error } = await supabase.from('profiles').delete().eq('id', employeeId);
      await Promise.all([refreshEmployees(), refetchAll()]);
      return { error };
    },

    // ── admin: rooms & vehicles ──
    saveRoom: async (id, form) => {
      const payload = {
        name: form.name.trim(),
        capacity: parseInt(form.capacity, 10) || 0,
        floor: parseInt(form.floor, 10) || 0,
        equipment: form.equipment,
        is_active: form.isActive !== false,
      };
      const { error } = id
        ? await supabase.from('rooms').update(payload).eq('id', id)
        : await supabase.from('rooms').insert([payload]);
      await loadRooms();
      return { error };
    },
    deleteRoom: async (id) => {
      await supabase.from('reservations').delete().eq('room_id', id);
      const { error } = await supabase.from('rooms').delete().eq('id', id);
      await Promise.all([loadRooms(), loadReservations()]);
      return { error };
    },
    saveVehicle: async (id, form) => {
      const payload = {
        model: form.model.trim(),
        plate: form.plate.trim().toUpperCase(),
        year: parseInt(form.year, 10) || null,
        type: form.type,
        is_active: form.isActive !== false,
      };
      const { error } = id
        ? await supabase.from('vehicles').update(payload).eq('id', id)
        : await supabase.from('vehicles').insert([payload]);
      await loadVehicles();
      return { error };
    },
    deleteVehicle: async (id) => {
      await supabase.from('reservations').delete().eq('vehicle_id', id);
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      await Promise.all([loadVehicles(), loadReservations()]);
      return { error };
    },
  }), [rooms, vehicles, documents, personalDays, loadRequests, loadPersonalDays, loadReservations, loadHours,
    loadDocuments, loadNews, loadRooms, loadVehicles, refreshEmployees, refetchAll, setUser]);

  const refresh = useCallback(async () => {
    try {
      await Promise.all([refetchAll(), refreshEmployees()]);
    } catch (e) {
      logError('refresh', e);
    }
  }, [refetchAll, refreshEmployees]);

  const onboardingDocUrl = useMemo(
    () => documents.find((d) => d.title === ONBOARDING_DOC_TITLE)?.fileUrl || null,
    [documents],
  );

  const value = useMemo(() => ({
    requests, reservations, rooms, vehicles, documents, hourCompensations, personalDays, news, notifications: myNotifications,
    unreadCount, loadingData, lastSync, onboardingDocUrl, refresh, ...actions,
  }), [requests, reservations, rooms, vehicles, documents, hourCompensations, personalDays, news, myNotifications,
    unreadCount, loadingData, lastSync, onboardingDocUrl, refresh, actions]);

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData() {
  return useContext(DataCtx);
}

