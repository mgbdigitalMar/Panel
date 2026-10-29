import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, useRequests, useNotifs } from '../context';
import { toUserMessage } from '../../shared/utils/errors.js';
import { allowedWorkModes } from '../../shared/services/workMode.js';
import { useTouch } from '../components/Touch';
import EmployeesTouch from './EmployeesTouch';
import EmployeesDesk from './EmployeesDesk';
import styles from './EmployeesPage.module.scss';

export default function EmployeesPage() {
  const { user, employees, setEmployees } = useAuth();
  const { requests, changeWorkMode } = useRequests();
  const { announce } = useNotifs();
  // Admins set any mode; an employee needs an approved request for remote / external
  const modeAllowed = (emp, mode) => user.role === 'admin' || allowedWorkModes(requests, emp.id, undefined, emp).has(mode);
  const isAdmin = user.role === 'admin';
  // The DNI is personal data: only RRHH and the person themselves see it
  const canSeeDni = (emp) => isAdmin || user.id === emp.id;
  // Last view used in this browser (grid, table or week)
  const [view, setViewState] = useState(() => {
    try { return ['grid', 'list', 'week'].includes(localStorage.getItem('margube_team_view')) ? localStorage.getItem('margube_team_view') : 'grid'; } catch { return 'grid'; }
  });
  const setView = (v) => {
    setViewState(v);
    try { localStorage.setItem('margube_team_view', v); } catch { /* storage blocked */ }
  };

  // Name search — also fed by the global search (?q=)
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setQuery(q);
  }, [searchParams]);

  const handleWorkModeChange = async (empId, mode) => {
    const previous = employees.find(e => e.id === empId)?.workMode;
    if (mode === previous) return;
    // Optimistic
    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, workMode: mode } : e));
    const { error } = await changeWorkMode(empId, mode);
    if (error) {
      console.error('Failed to update work_mode:', error);
      setEmployees(prev => prev.map(e => e.id === empId ? { ...e, workMode: previous } : e));
      announce('❌', `No se pudo cambiar el modo de trabajo: ${toUserMessage(error)}`, 7000);
    }
  };

  const touch = useTouch();

  // Phones and tablets: the web's touch directory
  if (touch) {
    return (
      <div className={styles.container}>
        <EmployeesTouch employees={employees} user={user} query={query} setQuery={setQuery} canSeeDni={canSeeDni}
          modeAllowed={modeAllowed} onModeChange={handleWorkModeChange} initialView={view} />
      </div>
    );
  }

  // Computers: departments, your mode, the figures that filter and the directory (EmployeesDesk)
  return (
    <div className={styles.container}>
      <EmployeesDesk employees={employees} user={user} query={query} setQuery={setQuery} canSeeDni={canSeeDni}
        modeAllowed={modeAllowed} onModeChange={handleWorkModeChange} view={view} setView={setView} />
    </div>
  );
}
