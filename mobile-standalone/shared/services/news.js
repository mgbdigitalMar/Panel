/**
 * News service — platform-agnostic.
 * CRUD for the `news` table.
 */

/** Fetch all news items */
export async function fetchNews(supabase) {
  const { data, error } = await supabase
    .from('news')
    .select('*, author:profiles!news_author_id_fkey(name, avatar_initials)')
    .order('published_at', { ascending: false });
  if (error) {
    console.error('fetchNews:', error);
    return [];
  }
  return data.map(n => ({
    id: n.id,
    type: n.type,
    title: n.title,
    content: n.content,
    authorId: n.author_id,
    authorName: n.author?.name || 'Usuario eliminado',
    authorAvatar: n.author?.avatar_initials || '??',
    date: n.published_at,
    pinned: n.pinned,
    category: n.category,
    isActive: n.is_active,
    createdAt: n.created_at,
  }));
}

/** Create a news item */
export async function createNews(supabase, payload) {
  const { error } = await supabase.from('news').insert([payload]);
  if (error) console.error('createNews:', error);
  return { error };
}

/** Update a news item */
export async function updateNews(supabase, id, payload) {
  const { error } = await supabase.from('news').update(payload).eq('id', id);
  if (error) console.error('updateNews:', error);
  return { error };
}

/** Delete a news item */
export async function deleteNews(supabase, id) {
  const { error } = await supabase.from('news').delete().eq('id', id);
  if (error) console.error('deleteNews:', error);
  return { error };
}
