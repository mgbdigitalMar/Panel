// Files in the private `documents` bucket: payslips, contracts, justificantes, the internal rules.
// Shared by the web and the app: no DOM or React Native imports.
//
// The bucket is private (supabase/migrations/20261123120000_private_documents.sql): an object
// can only be read with the session of someone whom the storage policy lets see it. The
// database keeps a reference to the object (file_url, an `/object/authenticated/` URL, or a
// legacy `/object/public/` one); the screens get a short-lived signed URL made for the person
// who is signed in, never a permanent link.

import { safeFileUrl } from '../utils/urls.js';

export const DOCUMENTS_BUCKET = 'documents';

/** Lifetime of a signed URL. The lists are signed again before it ends (SIGNED_URL_REFRESH_MS). */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;
export const SIGNED_URL_REFRESH_MS = 45 * 60 * 1000;

// Any Storage URL of the bucket: public (before the migration), authenticated (stored since)
// or signed (what the lists hold on screen)
const OBJECT_URL = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/documents\/([^?#]+)/;

/** Object path inside the bucket of a stored or signed URL, or null when it is not one of ours. */
export function storagePathFromUrl(url) {
  if (typeof url !== 'string') return null;
  const match = url.match(OBJECT_URL);
  if (!match) return null;
  try {
    const path = decodeURIComponent(match[1]);
    // A reference never climbs out of the bucket
    return path && !path.split('/').includes('..') ? path : null;
  } catch {
    return null;
  }
}

/**
 * The reference saved in file_url for an uploaded object. It is an https:// URL (the
 * database check public.check_file_url() and the storage policy match on it) that only
 * works with a session token, unlike the public one.
 * getPublicUrl only builds the string, without a request; the object is not public.
 */
export function storageRefUrl(supabase, path) {
  const { data } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path);
  return data.publicUrl.replace('/storage/v1/object/public/', '/storage/v1/object/authenticated/');
}

/**
 * Replaces each row's `fileUrl` that points to the bucket with a signed URL for the signed-in
 * person and keeps the stored reference in `fileRef` (used to delete the object).
 * A file Storage refuses to sign (no permission, missing object, network) gets fileUrl null:
 * nothing is shown rather than a link that fails or leaks. data: files and other links are
 * left as they are.
 */
export async function signFileUrls(supabase, rows, ttl = SIGNED_URL_TTL_SECONDS) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const paths = [...new Set(rows.map((r) => storagePathFromUrl(r?.fileUrl)).filter(Boolean))];
  const signed = new Map();
  if (paths.length) {
    try {
      const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrls(paths, ttl);
      if (error) console.warn('signFileUrls:', error.message);
      for (const item of data || []) {
        const url = safeFileUrl(item?.signedUrl);
        if (item?.path && url && !item.error) signed.set(item.path, url);
      }
    } catch (e) {
      console.warn('signFileUrls:', e?.message || e);
    }
  }
  return rows.map((row) => {
    if (!row) return row;
    const path = storagePathFromUrl(row.fileUrl);
    if (!path) return { ...row, fileRef: row.fileUrl ?? null };
    return { ...row, fileRef: row.fileUrl, fileUrl: signed.get(path) || null };
  });
}

/** Deletes the object behind a stored or signed URL. Other links are ignored. */
export async function removeStorageFile(supabase, fileUrl) {
  const path = storagePathFromUrl(fileUrl);
  if (!path) return;
  try {
    const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    if (error) console.warn('Storage delete error:', error.message);
  } catch (e) {
    console.warn('removeStorageFile error:', e?.message || e);
  }
}
