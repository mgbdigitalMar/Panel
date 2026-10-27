/**
 * Firma de las normas internas (PolicyModal en la web, PolicyScreen en la app).
 * The signature is stored as strokes in a 1000 x 400 box, not as an image or SVG markup:
 * both apps capture and draw it the same way and nothing in it can run as code.
 * Server side: supabase/migrations/20261027130000_policy_signatures.sql.
 */

export const POLICY_TITLE = 'Procedimiento normas internas 2026';
export const SIGNATURE_BOX = { width: 1000, height: 400 };

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Strokes drawn in a `width` x `height` pad → the shared 1000 x 400 box.
 * Points closer than ~1 unit are dropped (a still finger repeats the same point).
 * @param {Array<Array<[number, number]>>} strokes
 */
export function normalizeStrokes(strokes, width, height) {
  if (!width || !height) return [];
  const sx = SIGNATURE_BOX.width / width;
  const sy = SIGNATURE_BOX.height / height;
  return (strokes || [])
    .map((stroke) => {
      const out = [];
      for (const [x, y] of stroke) {
        const p = [
          round1(Math.min(SIGNATURE_BOX.width, Math.max(0, x * sx))),
          round1(Math.min(SIGNATURE_BOX.height, Math.max(0, y * sy))),
        ];
        const last = out[out.length - 1];
        if (!last || Math.abs(last[0] - p[0]) + Math.abs(last[1] - p[1]) >= 1) out.push(p);
      }
      return out;
    })
    .filter((stroke) => stroke.length > 0);
}

/** Same rule as the server: at least 10 points and 60 units wide (a dot or a tick is not a signature). */
export function isSignatureComplete(strokes) {
  const points = (strokes || []).flat();
  if (points.length < 10) return false;
  const xs = points.map((p) => p[0]);
  return Math.max(...xs) - Math.min(...xs) >= 60;
}

/** SVG path for the strokes (normalized or not); a single tap is drawn as a dot. */
export function strokesToPath(strokes) {
  return (strokes || [])
    .filter((s) => s.length)
    .map((s) => {
      const [x0, y0] = s[0];
      if (s.length === 1) return `M${x0} ${y0} l0.1 0`;
      return `M${x0} ${y0}` + s.slice(1).map(([x, y]) => ` L${x} ${y}`).join('');
    })
    .join(' ');
}

/** Signs the rules for the signed-in person. @returns {{ signedAt?: string, error?: object }} */
export async function signInternalPolicy(supabase, { signerName, strokes, documentTitle, documentUrl, platform, userAgent }) {
  const { data, error } = await supabase.rpc('sign_internal_policy', {
    p_signer_name: signerName,
    p_strokes: strokes,
    p_document_title: documentTitle || POLICY_TITLE,
    p_document_url: documentUrl || null,
    p_platform: platform || null,
    p_user_agent: userAgent || null,
  });
  if (error) {
    console.warn('signInternalPolicy:', error.code || '', error.message);
    return { error };
  }
  return { signedAt: data };
}

/**
 * Signatures the session may see: its own, or everyone's for an admin. Newest first.
 * null when they could not be loaded (or before the migration).
 */
export async function fetchPolicySignatures(supabase) {
  const { data, error } = await supabase
    .from('policy_signatures')
    .select('id, user_id, signer_name, strokes, document_title, document_url, platform, user_agent, signed_at')
    .order('signed_at', { ascending: false });
  if (error) {
    console.warn('fetchPolicySignatures:', error.message);
    return null;
  }
  return data.map((s) => ({
    id: s.id,
    userId: s.user_id,
    signerName: s.signer_name,
    strokes: s.strokes,
    documentTitle: s.document_title,
    documentUrl: s.document_url,
    platform: s.platform,
    userAgent: s.user_agent,
    signedAt: s.signed_at,
  }));
}

/** Latest signature of each person: { [userId]: signature } */
export function latestSignatureByUser(signatures) {
  const map = {};
  for (const s of signatures || []) {
    if (!map[s.userId] || s.signedAt > map[s.userId].signedAt) map[s.userId] = s;
  }
  return map;
}

/**
 * Where a person stands with the rules:
 * 'signed' (accepted and signed), 'manual' (accepted by RRHH without a digital signature),
 * 'pending' (has to sign at the next login).
 */
export function policyStatus(employee, signature) {
  if (employee?.policyAccepted !== true) return 'pending';
  return signature ? 'signed' : 'manual';
}

export const PLATFORM_LABELS = { web: 'Web', ios: 'App iPhone', android: 'App Android' };

/** "27/10/2026, 09:41" in Spain's time */
export function formatSignedAt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
