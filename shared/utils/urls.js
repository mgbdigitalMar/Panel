// file_url comes from the database and anyone can write their own rows, so it is
// checked before it reaches an href, an iframe or a WebView: a `javascript:` link
// would run in the intranet with the session of whoever opens it.
// Same rule as public.check_file_url() in supabase/migrations.

const ACTIVE_DATA = /^data:(text\/html|image\/svg|application\/xhtml|text\/xml|application\/xml)/i;

/** The URL if it is safe to open (http(s), a non-HTML data: file or a path in /public), else null. */
export function safeFileUrl(url) {
  if (typeof url !== 'string') return null;
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^data:/i.test(u)) return ACTIVE_DATA.test(u) ? null : u;
  if (u.startsWith('/') && !u.startsWith('//')) return u;
  return null;
}
