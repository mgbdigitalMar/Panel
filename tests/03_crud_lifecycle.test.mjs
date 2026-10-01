import { createClient } from '@supabase/supabase-js';

const url = 'https://exaggikhxozcfsifwxeq.supabase.co';
const key = 'sb_publishable_SaExpxl0EopS3TJPqqJDcg_SSU2Myvc';
const supabase = createClient(url, key);

export async function runCrudLifecycleTests() {
  console.log('\n🔵 [SUITE 3: Ciclo de Vida CRUD y Persistencia]');
  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`  ✅ ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // Obtenemos un usuario real para asociar los registros de prueba
  const { data: users, error: uErr } = await supabase.from('profiles').select('id, name').limit(1);
  if (uErr || !users || users.length === 0) {
    console.error('No se pudo obtener un usuario para las pruebas CRUD:', uErr);
    return { passed: 0, failed: 1 };
  }
  const testUserId = users[0].id;

  // 1. CRUD: Documentos (estados válidos: 'pending', 'signed', 'completed')
  const docPayload = {
    title: '__TEST_AUTOSUITE_DOCUMENT__',
    description: 'Documento generado automáticamente por test suite',
    file_url: 'data:text/plain;base64,dGVzdA==',
    status: 'pending',
    sender_id: testUserId,
    recipient_id: testUserId,
  };
  const { data: createdDoc, error: cDocErr } = await supabase.from('documents').insert(docPayload).select().single();
  assert('CREATE: Inserción de documento exitosa', !cDocErr && createdDoc?.id);

  if (createdDoc?.id) {
    // READ con join
    const { data: readDoc, error: rDocErr } = await supabase
      .from('documents')
      .select('id, title, status, sender:profiles!documents_sender_id_fkey(name)')
      .eq('id', createdDoc.id)
      .single();
    assert('READ: Lectura de documento con join de remitente exitosa', !rDocErr && readDoc?.title === docPayload.title);

    // UPDATE
    const { data: updDoc, error: uDocErr } = await supabase
      .from('documents')
      .update({ status: 'completed' })
      .eq('id', createdDoc.id)
      .select()
      .single();
    assert('UPDATE: Cambio de estado de documento exitoso (completed)', !uDocErr && updDoc?.status === 'completed');

    // DELETE
    const { error: dDocErr } = await supabase.from('documents').delete().eq('id', createdDoc.id);
    assert('DELETE: Eliminación de documento de prueba exitosa', !dDocErr);
  }

  // 2. CRUD: Compensación de Horas (tipos válidos: 'debe', 'ya')
  const hourPayload = {
    employee_id: testUserId,
    date: new Date().toISOString().slice(0, 10),
    reason: '__TEST_AUTOSUITE_HORAS__',
    hours: 3.5,
    type: 'debe',
    status: 'pending',
  };
  const { data: createdHour, error: cHourErr } = await supabase.from('hour_compensations').insert(hourPayload).select().single();
  assert('CREATE: Inserción de compensación de horas exitosa (3.5h, tipo debe)', !cHourErr && createdHour?.id);

  if (createdHour?.id) {
    const { data: readHour, error: rHourErr } = await supabase
      .from('hour_compensations')
      .select('id, hours, employee:profiles!hour_compensations_employee_id_fkey(name)')
      .eq('id', createdHour.id)
      .single();
    assert('READ: Lectura de compensación de horas con join exitosa', !rHourErr && parseFloat(readHour?.hours) === 3.5);

    const { data: updHour, error: uHourErr } = await supabase
      .from('hour_compensations')
      .update({ status: 'approved', reviewed_by: testUserId, reviewed_at: new Date().toISOString() })
      .eq('id', createdHour.id)
      .select()
      .single();
    assert('UPDATE: Aprobación y revisión de horas exitosa', !uHourErr && updHour?.status === 'approved');

    const { error: dHourErr } = await supabase.from('hour_compensations').delete().eq('id', createdHour.id);
    assert('DELETE: Limpieza de registro de horas exitosa', !dHourErr);
  }

  // 3. CRUD: Asuntos Propios (personal_days)
  const pdPayload = {
    employee_id: testUserId,
    date: new Date().toISOString().slice(0, 10),
    reason: '__TEST_AUTOSUITE_ASUNTO_PROPIO__',
    status: 'pending',
  };
  const { data: createdPd, error: cPdErr } = await supabase.from('personal_days').insert(pdPayload).select().single();
  assert('CREATE: Inserción de solicitud de Asuntos Propios exitosa', !cPdErr && createdPd?.id);

  if (createdPd?.id) {
    const { data: readPd, error: rPdErr } = await supabase
      .from('personal_days')
      .select('id, employee:profiles!personal_days_employee_id_fkey(name)')
      .eq('id', createdPd.id)
      .single();
    assert('READ: Lectura de asunto propio con join de empleado exitosa', !rPdErr && readPd?.id);

    const { data: updPd, error: uPdErr } = await supabase
      .from('personal_days')
      .update({ status: 'approved' })
      .eq('id', createdPd.id)
      .select()
      .single();
    assert('UPDATE: Aprobación de asunto propio exitosa', !uPdErr && updPd?.status === 'approved');

    const { error: dPdErr } = await supabase.from('personal_days').delete().eq('id', createdPd.id);
    assert('DELETE: Limpieza de solicitud de asuntos propios exitosa', !dPdErr);
  }

  // 4. CRUD: Noticias (news, enum news_type: 'news' | 'event')
  const newsPayload = {
    title: '__TEST_AUTOSUITE_NEWS__',
    content: 'Contenido de noticia de prueba automatizada',
    category: 'Empresa',
    type: 'news',
    pinned: true,
    is_active: true,
    author_id: testUserId,
    published_at: new Date().toISOString().slice(0, 10),
  };
  const { data: createdNews, error: cNewsErr } = await supabase.from('news').insert(newsPayload).select().single();
  assert('CREATE: Inserción de noticia con estado fijado (pinned: true) exitosa', !cNewsErr && createdNews?.id);

  if (createdNews?.id) {
    const { data: updNews, error: uNewsErr } = await supabase
      .from('news')
      .update({ title: '__TEST_AUTOSUITE_NEWS_EDITED__', pinned: false })
      .eq('id', createdNews.id)
      .select()
      .single();
    assert('UPDATE: Modificación de noticia exitosa', !uNewsErr && updNews?.pinned === false);

    const { error: dNewsErr } = await supabase.from('news').delete().eq('id', createdNews.id);
    assert('DELETE: Limpieza de noticia de prueba exitosa', !dNewsErr);
  }

  // 5. CRUD: Notificaciones (notifications, campo 'body')
  const notifPayload = {
    user_id: testUserId,
    title: '__TEST_AUTOSUITE_NOTIFICATION__',
    body: 'Mensaje de notificación de prueba',
    type: 'info',
    read: false,
  };
  const { data: createdNotif, error: cNotifErr } = await supabase.from('notifications').insert(notifPayload).select().single();
  assert('CREATE: Inserción de notificación exitosa', !cNotifErr && createdNotif?.id);

  if (createdNotif?.id) {
    const { data: updNotif, error: uNotifErr } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', createdNotif.id)
      .select()
      .single();
    assert('UPDATE: Marcado de notificación como leída exitoso', !uNotifErr && updNotif?.read === true);

    const { error: dNotifErr } = await supabase.from('notifications').delete().eq('id', createdNotif.id);
    assert('DELETE: Limpieza de notificación de prueba exitosa', !dNotifErr);
  }

  return { passed, failed };
}
