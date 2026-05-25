const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan credenciales de Supabase en el entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteMockDocs() {
  const titlesToDelete = [
    'Contrato de trabajo 2025',
    'Política de Teletrabajo',
    'NDA — Proyecto Atlántida'
  ];

  console.log('Buscando documentos de ejemplo para eliminar...');

  const { data, error } = await supabase
    .from('documents')
    .delete()
    .in('title', titlesToDelete)
    .select();

  if (error) {
    console.error('Error al eliminar documentos:', error.message);
  } else {
    console.log(`¡Eliminados ${data.length} documentos de ejemplo exitosamente!`);
    console.log(data);
  }
}

deleteMockDocs();
