import { useState } from 'react';
import { useAuth, useData } from '../context';
import { Input, Button, Card, Select, Badge } from '../components/ui';
import { Save, Lock, Shield, User, FileText, CheckCircle, PenTool, Download, Clock, Eye, X, ExternalLink } from 'lucide-react';
import styles from './ProfilePage.module.scss';
import clsx from 'clsx';
import { supabase } from '../utils/supabase';
import bcrypt from 'bcryptjs';

const WORK_MODES = {
  Office: { label: 'Oficina' },
  remoto: { label: 'Remoto' },
  externo: { label: 'Externo' },
};
const DEFAULT_WORK_MODE = 'Office';

// Detect if a URL is a PDF — handles both storage URLs and base64 data URLs
function isPDF(url) {
  if (!url) return false;
  // Base64 data URL: data:application/pdf;base64,...
  if (url.startsWith('data:application/pdf')) return true;
  // Storage URL: ends with .pdf (ignore query params)
  const clean = url.split('?')[0].toLowerCase();
  return clean.endsWith('.pdf');
}

export default function ProfilePage() {
  const { user, setCurrentUser } = useAuth();
  const { documents, updateDocumentStatus } = useData();

  // Match by real UUID (production) or show all if none match (dev/mock mode)
  const myDocsFiltered = (documents || []).filter(d => String(d.recipientId) === String(user?.id));
  const myDocs = myDocsFiltered.length > 0 ? myDocsFiltered : (documents || []);

  const [updatingDoc, setUpdatingDoc] = useState(null);

  // Viewer modal state
  const [viewerDoc, setViewerDoc] = useState(null); // doc object

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    workMode: user?.workMode || DEFAULT_WORK_MODE,
  });
  const [loading, setLoading] = useState(false);
  const [workModeLoading, setWorkModeLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleWorkModeChange = async (mode) => {
    if (mode === form.workMode) return;
    setWorkModeLoading(true);
    setMessage('');
    try {
      setForm({ ...form, workMode: mode });
      await setCurrentUser({ id: user.id, workMode: mode });
      setMessage('Modo de trabajo actualizado correctamente.');
    } catch (error) {
      console.error('Error updating work mode:', error);
      setForm({ ...form, workMode: user?.workMode || DEFAULT_WORK_MODE });
      setMessage('Error al actualizar el modo de trabajo. Intenta de nuevo.');
    } finally {
      setWorkModeLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (form.newPassword !== form.confirmPassword) { setMessage('Las contraseñas no coinciden.'); return; }
    if (form.newPassword.length < 6) { setMessage('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
    if (!form.currentPassword) { setMessage('Introduce la contraseña actual.'); return; }
    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('password_hash').eq('id', user.id).single();
      const isCurrentValid = bcrypt.compareSync(form.currentPassword, profile.password_hash);
      if (!isCurrentValid) { setMessage('Contraseña actual incorrecta.'); setLoading(false); return; }
      const hashedPassword = await bcrypt.hash(form.newPassword, 10);
      const { error } = await supabase.from('profiles').update({ password_hash: hashedPassword }).eq('id', user.id);
      if (error) throw error;
      setMessage('Contraseña actualizada correctamente. Usa la nueva en próximo login.');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '', workMode: form.workMode });
    } catch (error) {
      console.error('Password change error:', error);
      setMessage('Error al actualizar contraseña. Verifica datos.');
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Mi Perfil</h1>
        <p>Actualiza tu información personal</p>
      </div>

      <div className={styles.cards}>
        {/* User Info */}
        <Card className={styles.infoCard}>
          <div className={styles.cardHeader}>
            <User size={20} /><h3>Mi Información</h3>
          </div>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Nombre</span><span className={styles.infoValue}>{user?.name}</span></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Email</span><span className={styles.infoValue}>{user?.email}</span></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Rol</span><Badge status={user?.role} /></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Departamento</span><span className={styles.infoValue}>{user?.dept}</span></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>DNI</span><span className={styles.infoValue}>{user?.phone}</span></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Fecha nacimiento</span><span className={styles.infoValue}>{user?.birthdate ? new Date(user.birthdate).toLocaleDateString('es-ES') : 'No especificada'}</span></div>
          </div>
        </Card>

        {/* Work Mode */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}><Shield size={20} /><h3>Modo de Trabajo</h3></div>
          <Select label="" value={form.workMode} onChange={handleWorkModeChange} options={Object.entries(WORK_MODES).map(([k, m]) => ({ value: k, label: m.label }))} className={styles.select} loading={workModeLoading} disabled={workModeLoading} />
        </Card>

        {/* Password */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}><Lock size={20} /><h3>Cambiar Contraseña</h3></div>
          <div className={styles.form}>
            <Input label="Contraseña actual" type="password" value={form.currentPassword} onChange={(v) => setForm({ ...form, currentPassword: v })} placeholder="••••••••" />
            <Input label="Nueva contraseña" type="password" value={form.newPassword} onChange={(v) => setForm({ ...form, newPassword: v })} placeholder="Mínimo 6 caracteres" />
            <Input label="Confirmar nueva contraseña" type="password" value={form.confirmPassword} onChange={(v) => setForm({ ...form, confirmPassword: v })} placeholder="Repite la nueva contraseña" />
            <Button icon={Save} onClick={handlePasswordChange} loading={loading} disabled={!form.newPassword || form.newPassword.length < 6} className={styles.saveBtn}>Actualizar Contraseña</Button>
          </div>
        </Card>

        {/* Mis Documentos */}
        <Card className={styles.docsCard}>
          <div className={styles.cardHeader}>
            <FileText size={20} />
            <h3>Mis Documentos</h3>
            {myDocs.length > 0 && <span className={styles.docsBadge}>{myDocs.length}</span>}
          </div>

          {myDocs.length === 0 ? (
            <div className={styles.docsEmpty}>
              <FileText size={40} strokeWidth={1} />
              <p>No tienes documentos asignados</p>
            </div>
          ) : (
            <div className={styles.docsList}>
              {myDocs.map(doc => {
                const isPending   = doc.status === 'pending';
                const isSigned    = doc.status === 'signed';
                const isCompleted = doc.status === 'completed';
                const isUpdating  = updatingDoc === doc.id;
                const hasFile     = !!doc.fileUrl;
                return (
                  <div key={doc.id} className={clsx(styles.docItem, {
                    [styles.docPending]:   isPending,
                    [styles.docSigned]:    isSigned,
                    [styles.docCompleted]: isCompleted,
                  })}>
                    <div className={styles.docIcon}><FileText size={22} /></div>
                    <div className={styles.docBody}>
                      <div className={styles.docTop}>
                        <strong className={styles.docTitle}>{doc.title}</strong>
                        <span className={clsx(styles.docStatus, {
                          [styles.statusPending]:   isPending,
                          [styles.statusSigned]:    isSigned,
                          [styles.statusCompleted]: isCompleted,
                        })}>
                          {isPending   && <><Clock size={11} /> Pendiente</>}
                          {isSigned    && <><PenTool size={11} /> Firmado</>}
                          {isCompleted && <><CheckCircle size={11} /> Completado</>}
                        </span>
                      </div>
                      {doc.description && <p className={styles.docDesc}>{doc.description}</p>}
                      <div className={styles.docMeta}>
                        <span>Enviado por <strong>{doc.senderName}</strong></span>
                        <span>·</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>

                    <div className={styles.docActions}>
                      {/* View file button */}
                      {hasFile && (
                        isPDF(doc.fileUrl) ? (
                          <button className={clsx(styles.docBtn, styles.docBtnView)} onClick={() => setViewerDoc(doc)} title="Ver PDF">
                            <Eye size={14} /><span>Ver</span>
                          </button>
                        ) : (
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className={clsx(styles.docBtn, styles.docBtnView)} title="Abrir archivo">
                            <ExternalLink size={14} /><span>Abrir</span>
                          </a>
                        )
                      )}
                      {/* Download button */}
                      {hasFile && (
                        <a href={doc.fileUrl} download className={styles.docBtn} title="Descargar">
                          <Download size={14} />
                        </a>
                      )}
                      {/* Status actions */}
                      {isPending && (
                        <>
                          <button className={clsx(styles.docBtn, styles.docBtnComplete)} disabled={isUpdating}
                            onClick={async () => { setUpdatingDoc(doc.id); await updateDocumentStatus(doc.id, 'completed'); setUpdatingDoc(null); }}
                            title="Marcar como completado">
                            <CheckCircle size={14} /><span>Completar</span>
                          </button>
                          <button className={clsx(styles.docBtn, styles.docBtnSign)} disabled={isUpdating}
                            onClick={async () => { setUpdatingDoc(doc.id); await updateDocumentStatus(doc.id, 'signed'); setUpdatingDoc(null); }}
                            title="Marcar como firmado">
                            <PenTool size={14} /><span>Firmar</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {message && (
        <div className={clsx(styles.message, message.includes('Error') ? styles.error : styles.success)}>
          {message}
        </div>
      )}

      {/* ── Document Viewer Modal ── */}
      {viewerDoc && (
        <div className={styles.viewerOverlay} onClick={() => setViewerDoc(null)}>
          <div className={styles.viewerModal} onClick={e => e.stopPropagation()}>
            <div className={styles.viewerHeader}>
              <div className={styles.viewerTitle}>
                <FileText size={18} />
                <span>{viewerDoc.title}</span>
              </div>
              <div className={styles.viewerHeaderActions}>
                <a href={viewerDoc.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.viewerAction} title="Abrir en nueva pestaña">
                  <ExternalLink size={16} />
                </a>
                <a href={viewerDoc.fileUrl} download className={styles.viewerAction} title="Descargar">
                  <Download size={16} />
                </a>
                <button className={styles.viewerClose} onClick={() => setViewerDoc(null)} title="Cerrar">
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              src={viewerDoc.fileUrl + '#toolbar=1&navpanes=0'}
              className={styles.viewerFrame}
              title={viewerDoc.title}
            />
          </div>
        </div>
      )}
    </div>
  );
}
