/**
 * Documents service — platform-agnostic.
 * CRUD for the `documents` table + Storage helpers.
 */
import { createNotification } from './notifications.js';
import { MAX_FILE_SIZE_BYTES } from '../config/constants.js';

/** Fetch all documents */
export async function fetchDocuments(supabase) {
  const { data, error } = await supabase
    .from('documents')
    .select(`
      id, title, description, file_url, status, created_at, updated_at,
      sender_id, recipient_id,
      sender:profiles!documents_sender_id_fkey(name),
      recipient:profiles!documents_recipient_id_fkey(name)
    `)
    .order('created_at', { ascending: false });
  if (error || !data) {
    if (error) console.error('fetchDocuments:', error);
    return [];
  }
  return data.map(d => ({
    id: d.id,
    title: d.title,
    description: d.description,
    fileUrl: d.file_url,
    status: d.status,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    senderId: d.sender_id,
    senderName: d.sender?.name || null,
    recipientId: d.recipient_id,
    recipientName: d.recipient?.name || null,
  }));
}

/** Send a document */
export async function sendDocument(supabase, { title, description, fileUrl, senderId, recipientId }) {
  const { data, error } = await supabase.from('documents').insert([{
    title,
    description,
    file_url: fileUrl || null,
    sender_id: senderId,
    recipient_id: recipientId,
    status: 'pending',
  }]).select().single();

  if (error) {
    console.error('sendDocument:', error);
    return { error };
  }

  if (recipientId) {
    await createNotification(supabase, {
      userId: recipientId,
      title: `📄 Nuevo documento: ${title}`,
      body: description || 'Tienes un nuevo documento disponible en tu perfil.',
      type: 'info',
      entityType: 'document',
      entityId: data?.id,
    });
  }
  return { data };
}

/** Update document status */
export async function updateDocumentStatus(supabase, id, status) {
  const { error } = await supabase.from('documents').update({
    status,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) console.error('updateDocumentStatus:', error);
  return { error };
}

/** Delete a document (also cleans up storage file) */
export async function deleteDocument(supabase, id, fileUrl) {
  await removeStorageFile(supabase, fileUrl);
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) console.error('deleteDocument:', error);
  return { error };
}

/** Remove a file from Supabase Storage */
export async function removeStorageFile(supabase, fileUrl) {
  if (!fileUrl || !fileUrl.includes('/storage/v1/object/public/documents/')) return;
  try {
    const marker = '/storage/v1/object/public/documents/';
    const idx = fileUrl.indexOf(marker);
    if (idx === -1) return;
    let path = fileUrl.substring(idx + marker.length);
    const qIdx = path.indexOf('?');
    if (qIdx !== -1) path = path.substring(0, qIdx);
    if (!path) return;
    const { error } = await supabase.storage.from('documents').remove([decodeURIComponent(path)]);
    if (error) console.warn('Storage delete error:', error.message);
  } catch (e) {
    console.warn('removeStorageFile error:', e);
  }
}

/**
 * Upload a file to Supabase Storage.
 * @param {Blob|ArrayBuffer|Uint8Array} file - file body
 * @param {string} [contentType] - MIME type; required when `file` is raw bytes
 *   (React Native), otherwise Storage serves it as text/plain.
 */
export async function uploadDocumentFile(supabase, file, fileName, fileSize, contentType) {
  if (!file) return { url: null };

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return { error: 'El archivo supera el tamaño máximo permitido (15 MB).' };
  }

  try {
    const ext = fileName.split('.').pop();
    const path = `docs/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(path, file, { cacheControl: '3600', upsert: false, ...(contentType ? { contentType } : {}) });

    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
      return { url: publicUrl };
    }

    console.warn('Storage upload error:', upErr.message);
    return { error: `Error de Storage: ${upErr.message}` };
  } catch (e) {
    console.warn('Upload error:', e);
    return { error: 'Error subiendo archivo.' };
  }
}
