export function nativeAssistantContext(user, data) {
  const find = (id, type) => {
    const rows = type === 'asuntos_propios' ? data.personalDays : data.requests;
    const row = rows.find(item => String(item.id) === String(id));
    if (!row) throw new Error('El trámite ya no está disponible. Actualiza tus datos.');
    return { ...row, ...(type === 'asuntos_propios' ? { type } : {}) };
  };
  return {
    ...data, user,
    createRequest: (_actor, payload) => data.createRequest(payload),
    createReservation: (_actor, payload) => data.createReservation(payload),
    deleteRequest: (id, type) => data.deleteRequest(find(id, type)),
    updatePersonalDayStatus: (id, status) => data.setRequestStatus(find(id, 'asuntos_propios'), status),
    updateRequestStatus: (id, status) => data.setRequestStatus(find(id), status),
    updateReservationStatus: (id, status) => data.setReservationStatus(id, status),
  };
}
