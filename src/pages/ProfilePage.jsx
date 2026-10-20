import { useState, useEffect } from "react";
import { useAuth, useDocuments, useRequests } from "../context";
import { allowedWorkModes } from "../../shared/services/workMode.js";
import { Input, Button, Card, Select, Badge, Avatar, Portal, useInertApp } from "../components/ui";
import {
  Save,
  Lock,
  Shield,
  User,
  FileText,
  CheckCircle,
  PenTool,
  Download,
  Clock,
  Eye,
  X,
  ExternalLink,
  Mail,
  MapPin,
} from "lucide-react";
import styles from "./ProfilePage.module.scss";
import clsx from "clsx";
import { supabase } from "../utils/supabase";
// bcrypt is dynamically imported on demand to save bundle size
import { useAutoDismiss } from "../hooks/useAutoDismiss";


const WORK_MODES = {
  Office: { label: "Oficina" },
  remoto: { label: "Remoto" },
  externo: { label: "Externo" },
};
const DEFAULT_WORK_MODE = "Office";

// Check if file is viewable and return its viewer URL
function getViewerUrl(url) {
  if (!url) return null;
  if (url.startsWith("data:")) return url; // Base64 data URL
  const clean = url.split("?")[0].toLowerCase();
  if (clean.match(/\.(pdf|png|jpe?g|gif|webp|svg)$/i)) {
    return url + "#toolbar=1&navpanes=0";
  }
  if (clean.match(/\.(doc|docx|xls|xlsx|ppt|pptx)$/i)) {
    return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
  }
  return null;
}

export default function ProfilePage() {
  const { user, employees } = useAuth();
  const { documents, updateDocumentStatus } = useDocuments();
  const { requests, changeWorkMode } = useRequests();

  // Only show documents explicitly sent to the current user
  const myDocs = (documents || []).filter(
    (d) => String(d.recipientId) === String(user?.id)
  );

  const [updatingDoc, setUpdatingDoc] = useState(null);

  // Viewer modal state
  const [viewerDoc, setViewerDoc] = useState(null); // doc object

  // Viewer covers the whole app (sidebar included); Escape closes it
  useInertApp(!!viewerDoc);
  useEffect(() => {
    if (!viewerDoc) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setViewerDoc(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerDoc]);

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  // Follows the profile live: an approved request or another device can change it
  const workMode = user?.workMode || DEFAULT_WORK_MODE;
  // Remote / external need an approved request covering today
  const allowedModes = allowedWorkModes(requests, user?.id);
  const [loading, setLoading] = useState(false);
  const [workModeLoading, setWorkModeLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Auto-dismiss success/error messages after 4 seconds
  useAutoDismiss(message, setMessage, 4000);


  const handleWorkModeChange = async (mode) => {
    if (mode === workMode) return;
    setWorkModeLoading(true);
    setMessage("");
    const { error } = await changeWorkMode(user.id, mode);
    if (error) {
      console.error("Error updating work mode:", error);
      setMessage("Error al actualizar el modo de trabajo. Intenta de nuevo.");
    } else {
      setMessage(mode === DEFAULT_WORK_MODE
        ? "Has vuelto a la oficina. Se ha avisado a administración."
        : "Modo de trabajo actualizado correctamente.");
    }
    setWorkModeLoading(false);
  };

  const handlePasswordChange = async () => {
    if (form.newPassword !== form.confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    if (form.newPassword.length < 6) {
      setMessage("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (!form.currentPassword) {
      setMessage("Introduce la contraseña actual.");
      return;
    }
    setLoading(true);
    try {
      const bcryptModule = await import("bcryptjs");
      const bcrypt = bcryptModule.default || bcryptModule;

      const { data: profile } = await supabase
        .from("profiles")
        .select("password_hash")
        .eq("id", user.id)
        .single();
      const isCurrentValid = bcrypt.compareSync(
        form.currentPassword,
        profile.password_hash,
      );
      if (!isCurrentValid) {
        setMessage("Contraseña actual incorrecta.");
        setLoading(false);
        return;
      }
      const hashedPassword = await bcrypt.hash(form.newPassword, 10);
      const { error } = await supabase
        .from("profiles")
        .update({ password_hash: hashedPassword })
        .eq("id", user.id);
      if (error) throw error;
      setMessage(
        "Contraseña actualizada correctamente. Usa la nueva en próximo login.",
      );
      setForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("Password change error:", error);
      setMessage("Error al actualizar contraseña. Verifica datos.");
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      {/* Identity: the brand panel with the person's leaf avatar */}
      <section className={styles.hero} aria-label="Tu identidad">
        <Avatar initials={user?.avatar || '??'} src={user?.avatarUrl} size={88} className={styles.heroAvatar} />
        <div className={styles.heroText}>
          <h2 className={styles.heroName}>{user?.name}</h2>
          <p className={styles.heroRole}>{[user?.position, user?.dept].filter(Boolean).join(' · ') || 'Margube'}</p>
          <div className={styles.heroTags}>
            <span className={styles.heroTag}><Shield size={12} aria-hidden="true" /> {user?.role === 'admin' ? 'Administrador' : 'Empleado'}</span>
            <span className={styles.heroTag}><MapPin size={12} aria-hidden="true" /> {WORK_MODES[workMode]?.label || 'Oficina'}</span>
            {user?.email && <span className={styles.heroTag}><Mail size={12} aria-hidden="true" /> {user.email}</span>}
          </div>
        </div>
      </section>

      <div className={styles.cards}>
        {/* User Info */}
        <div>
        <Card className={styles.infoCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon} aria-hidden="true"><User size={17} /></span>
            <h3>Mi información</h3>
          </div>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Nombre</span>
              <span className={styles.infoValue}>{user?.name}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Email</span>
              <span className={styles.infoValue}>{user?.email}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Rol</span>
              <Badge status={user?.role} />
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Departamento</span>
              <span className={styles.infoValue}>{user?.dept}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>DNI</span>
              <span className={styles.infoValue}>{user?.phone}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Fecha nacimiento</span>
              <span className={styles.infoValue}>
                {user?.birthdate
                  ? new Date(user.birthdate).toLocaleDateString("es-ES")
                  : "No especificada"}
              </span>
            </div>
          </div>
        </Card>
        </div>

        {/* Work Mode */}
        <div>
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon} aria-hidden="true"><Shield size={17} /></span>
            <h3>Modo de trabajo</h3>
          </div>
          <Select
            label=""
            value={workMode}
            onChange={handleWorkModeChange}
            options={Object.entries(WORK_MODES).map(([k, m]) => ({
              value: k,
              label: m.label,
              disabled: k !== workMode && !allowedModes.has(k),
            }))}
            className={styles.select}
            loading={workModeLoading}
            disabled={workModeLoading}
          />
          <p className={styles.hint}>
            {workMode === DEFAULT_WORK_MODE
              ? "Remoto y externo se activan solos cuando administración aprueba tu solicitud para hoy."
              : "Si vuelves antes a la oficina, elige Oficina: se avisará a administración."}
          </p>
        </Card>
        </div>

        {/* Password */}
        <div>
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon} aria-hidden="true"><Lock size={17} /></span>
            <h3>Cambiar contraseña</h3>
          </div>
          <div className={styles.form}>
            <Input
              label="Contraseña actual"
              type="password"
              value={form.currentPassword}
              onChange={(v) => setForm({ ...form, currentPassword: v })}
              placeholder="••••••••"
            />
            <Input
              label="Nueva contraseña"
              type="password"
              value={form.newPassword}
              onChange={(v) => setForm({ ...form, newPassword: v })}
              placeholder="Mínimo 6 caracteres"
            />
            <Input
              label="Confirmar nueva contraseña"
              type="password"
              value={form.confirmPassword}
              onChange={(v) => setForm({ ...form, confirmPassword: v })}
              placeholder="Repite la nueva contraseña"
            />
            <Button
              icon={Save}
              onClick={handlePasswordChange}
              loading={loading}
              disabled={!form.newPassword || form.newPassword.length < 6}
              className={styles.saveBtn}
            >
              Actualizar contraseña
            </Button>
          </div>
        </Card>
        </div>

        {/* Mis Documentos */}
        <div>
        <Card className={styles.docsCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon} aria-hidden="true"><FileText size={17} /></span>
            <h3>Mis documentos</h3>
            {myDocs.length > 0 && (
              <span className={styles.docsBadge}>{myDocs.length}</span>
            )}
          </div>

          {myDocs.length === 0 ? (
            <div className={styles.docsEmpty}>
              <FileText size={40} strokeWidth={1} />
              <p>No tienes documentos asignados</p>
            </div>
          ) : (
            <div className={styles.docsList}>
              {myDocs.map((doc) => {
                const isPending = doc.status === "pending";
                const isSigned = doc.status === "signed";
                const isCompleted = doc.status === "completed";
                const isUpdating = updatingDoc === doc.id;
                const hasFile = !!doc.fileUrl;
                return (
                  <div
                    key={doc.id}
                    className={clsx(styles.docItem, {
                      [styles.docPending]: isPending,
                      [styles.docSigned]: isSigned,
                      [styles.docCompleted]: isCompleted,
                    })}
                  >
                    <div className={styles.docIcon}>
                      <FileText size={22} />
                    </div>
                    <div className={styles.docBody}>
                      <div className={styles.docTop}>
                        <strong className={styles.docTitle}>{doc.title}</strong>
                        <span
                          className={clsx(styles.docStatus, {
                            [styles.statusPending]: isPending,
                            [styles.statusSigned]: isSigned,
                            [styles.statusCompleted]: isCompleted,
                          })}
                        >
                          {isPending && (
                            <>
                              <Clock size={11} /> Pendiente
                            </>
                          )}
                          {isSigned && (
                            <>
                              <PenTool size={11} /> Firmado
                            </>
                          )}
                          {isCompleted && (
                            <>
                              <CheckCircle size={11} /> Completado
                            </>
                          )}
                        </span>
                      </div>
                      {doc.description && (
                        <p className={styles.docDesc}>{doc.description}</p>
                      )}
                      <div className={styles.docMeta}>
                        <span>
                          Enviado por{" "}
                          <strong>
                            {employees?.find(
                              (e) => String(e.id) === String(doc.senderId),
                            )?.name ||
                              doc.senderName ||
                              "Administración"}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          el{" "}
                          {new Date(doc.createdAt).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className={styles.docActions}>
                      {/* View file button */}
                      {hasFile &&
                        (getViewerUrl(doc.fileUrl) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Eye}
                            onClick={() =>
                              setViewerDoc({
                                ...doc,
                                viewerUrl: getViewerUrl(doc.fileUrl),
                              })
                            }
                            title="Ver documento"
                          >
                            Ver
                          </Button>
                        ) : (
                          <Button
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="ghost"
                            size="sm"
                            icon={ExternalLink}
                            title="Abrir archivo"
                          >
                            Abrir
                          </Button>
                        ))}
                      {/* Download button */}
                      {hasFile && (
                        <Button
                          href={doc.fileUrl}
                          download
                          variant="ghost"
                          size="sm"
                          iconOnly
                          icon={Download}
                          title="Descargar"
                        />
                      )}
                      {/* Status actions */}
                      {isPending && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={CheckCircle}
                            disabled={isUpdating}
                            onClick={async () => {
                              setUpdatingDoc(doc.id);
                              await updateDocumentStatus(doc.id, "completed");
                              setUpdatingDoc(null);
                            }}
                            title="Marcar como completado"
                          >
                            Completar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={PenTool}
                            disabled={isUpdating}
                            onClick={async () => {
                              setUpdatingDoc(doc.id);
                              await updateDocumentStatus(doc.id, "signed");
                              setUpdatingDoc(null);
                            }}
                            title="Marcar como firmado"
                          >
                            Firmar
                          </Button>
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
      </div>

      {message && (
        <div
          className={clsx(
            styles.message,
            message.includes("Error") ? styles.error : styles.success,
          )}
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
      )}

      {/* ── Document Viewer Modal ── */}
      {viewerDoc && (
        <Portal>
        <div
          className={styles.viewerOverlay}
          onClick={() => setViewerDoc(null)}
          role="dialog"
          aria-modal="true"
          aria-label={viewerDoc.title}
        >
          <div
            className={styles.viewerModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.viewerHeader}>
              <div className={styles.viewerTitle}>
                <FileText size={18} />
                <span>{viewerDoc.title}</span>
              </div>
              <div className={styles.viewerHeaderActions}>
                <Button
                  href={viewerDoc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={ExternalLink}
                  title="Abrir en nueva pestaña"
                />
                <Button
                  href={viewerDoc.fileUrl}
                  download
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={Download}
                  title="Descargar"
                />
                <Button
                  variant="action-danger"
                  size="sm"
                  iconOnly
                  icon={X}
                  onClick={() => setViewerDoc(null)}
                  title="Cerrar"
                />
              </div>
            </div>
            <iframe
              src={viewerDoc.viewerUrl || viewerDoc.fileUrl}
              className={styles.viewerFrame}
              title={viewerDoc.title}
            />
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
