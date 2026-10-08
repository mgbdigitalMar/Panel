import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { buildRequestItems } from '../utils/domain';

/**
 * Everything waiting for an admin decision, as one list for the approvals inbox:
 * requests + personal days, reservations, and "bolsa" hours.
 */
export function usePendingApprovals() {
  const { user, employees } = useAuth();
  const { requests, personalDays, reservations, hourCompensations } = useData();

  return useMemo(() => {
    if (user?.role !== 'admin') return [];
    const reqs = buildRequestItems(requests, personalDays, employees)
      .filter((r) => r.status === 'pending')
      .map((r) => ({ kind: 'request', key: `${r.type}-${r.id}`, item: r, createdAt: r.createdAt }));
    const res = reservations
      .filter((r) => r.status === 'pending')
      .map((r) => ({ kind: 'reservation', key: `res-${r.id}`, item: r, createdAt: r.createdAt || r.date }));
    const hrs = hourCompensations
      .filter((h) => h.type === 'bolsa' && h.status === 'pending')
      .map((h) => ({ kind: 'hours', key: `h-${h.id}`, item: h, createdAt: h.createdAt }));
    return [...reqs, ...res, ...hrs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [user?.role, requests, personalDays, reservations, hourCompensations, employees]);
}
