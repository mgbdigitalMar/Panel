// File handling for the app: picking (documents or camera), uploading to the
// same Supabase Storage bucket as the web, viewing, downloading and sharing.
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import { File, Directory, Paths } from 'expo-file-system';
import { uploadDocumentFile } from '@shared/services/documents.js';
import { MAX_FILE_SIZE_BYTES } from '@shared/config/constants.js';
import { UserFacingError } from '@shared/utils/errors.js';
import { supabase } from '../lib/supabase';

const MIME_BY_EXT = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
};

export function extOf(name = '') {
  const clean = String(name).split('?')[0].split('#')[0];
  const i = clean.lastIndexOf('.');
  return i >= 0 ? clean.slice(i + 1).toLowerCase() : '';
}

export function mimeOf(name, fallback = 'application/octet-stream') {
  return MIME_BY_EXT[extOf(name)] || fallback;
}

/**
 * @typedef {{ uri: string, name: string, size: number, mimeType: string }} PickedFile
 */

/** Pick a file from the device. `kind` = 'any' | 'pdf'. Returns null if cancelled. */
export async function pickDocument(kind = 'any') {
  const type = kind === 'pdf'
    ? 'application/pdf'
    : ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.*', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint', 'text/plain'];
  const res = await DocumentPicker.getDocumentAsync({ type, copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return checkSize({
    uri: a.uri,
    name: a.name || `archivo.${extOf(a.uri) || 'bin'}`,
    size: a.size ?? new File(a.uri).size ?? 0,
    mimeType: a.mimeType || mimeOf(a.name),
  });
}

/** Take a photo with the camera (e.g. a paper justificante). Returns null if cancelled. */
export async function takePhoto() {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    throw new UserFacingError('Necesitamos permiso de cámara. Actívalo en Ajustes del sistema > Aplicaciones > Margube.');
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const name = a.fileName || `justificante_${Date.now()}.jpg`;
  return checkSize({
    uri: a.uri,
    name,
    size: a.fileSize ?? new File(a.uri).size ?? 0,
    mimeType: a.mimeType || 'image/jpeg',
  });
}

function checkSize(file) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new UserFacingError('El archivo supera el tamaño máximo permitido (15 MB).');
  }
  return file;
}

/** Upload a picked file to Storage. Resolves to the public URL. */
export async function uploadPickedFile(picked) {
  if (!picked) return null;
  const bytes = await new File(picked.uri).bytes();
  const res = await uploadDocumentFile(supabase, bytes, picked.name, bytes.byteLength, picked.mimeType);
  if (res?.error || !res?.url) {
    throw new UserFacingError(typeof res?.error === 'string' ? res.error : 'No se ha podido subir el archivo. Inténtalo de nuevo.');
  }
  return res.url;
}

// ── Viewing / sharing ───────────────────────────────────────────────

/** URL a WebView can render, or null when the file must be downloaded instead. */
export function viewerUrl(url) {
  if (!url) return null;
  if (url.startsWith('data:image/')) return url;
  if (url.startsWith('data:')) return null;
  const ext = extOf(url);
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return url;
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
    // Android WebView cannot render PDFs natively; Google's viewer can (same trick as the web).
    return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
  }
  return null;
}

function safeName(name) {
  return String(name || 'documento').replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, '_').trim().slice(0, 80) || 'documento';
}

function decodeBase64(b64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (chars.indexOf(clean[i]) << 18) | (chars.indexOf(clean[i + 1]) << 12)
      | ((chars.indexOf(clean[i + 2]) & 63) << 6) | (chars.indexOf(clean[i + 3]) & 63);
    out[o++] = (n >> 16) & 255;
    if (clean[i + 2] !== undefined) out[o++] = (n >> 8) & 255;
    if (clean[i + 3] !== undefined) out[o++] = n & 255;
  }
  return out.slice(0, o);
}

/** Download a document (public URL or legacy base64 data URL) and open the share sheet. */
export async function downloadAndShare(url, title = 'documento') {
  if (!url) return;
  const dir = new Directory(Paths.cache, `dl-${Date.now()}`);
  dir.create({ intermediates: true });

  let file;
  let mimeType;
  if (url.startsWith('data:')) {
    const [, meta = '', data = ''] = url.match(/^data:([^,]*),(.*)$/s) || [];
    mimeType = meta.split(';')[0] || 'application/octet-stream';
    const ext = Object.keys(MIME_BY_EXT).find((k) => MIME_BY_EXT[k] === mimeType) || 'bin';
    file = new File(dir, `${safeName(title)}.${ext}`);
    file.create();
    file.write(meta.includes('base64') ? decodeBase64(data) : decodeURIComponent(data));
  } else {
    const ext = extOf(url);
    file = new File(dir, `${safeName(title)}${ext ? `.${ext}` : ''}`);
    await File.downloadFileAsync(url, file);
    mimeType = mimeOf(url);
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new UserFacingError('Este dispositivo no permite compartir archivos.');
  }
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: title });
}

/** Build a CSV like the web's "Descargar Excel" (semicolon separated, UTF-8 BOM) and share it. */
export async function exportCsv(filename, headers, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const content = `﻿${[headers, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')}`;
  const dir = new Directory(Paths.cache, `csv-${Date.now()}`);
  dir.create({ intermediates: true });
  const file = new File(dir, filename);
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: filename, UTI: 'public.comma-separated-values-text' });
}

/** Open a PDF shipped inside the app (e.g. the internal rules) in the device's PDF viewer. */
export async function openBundledPdf(moduleId, title) {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const src = new File(asset.localUri || asset.uri);
  const dir = new Directory(Paths.cache, `pdf-${Date.now()}`);
  dir.create({ intermediates: true });
  const dest = new File(dir, `${safeName(title)}.pdf`);
  await src.copy(dest);
  await Sharing.shareAsync(dest.uri, { mimeType: 'application/pdf', dialogTitle: title, UTI: 'com.adobe.pdf' });
}
