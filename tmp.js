const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')
const bcrypt = require('bcryptjs')

const projectPath = 'c:/Users/Jehangir/Documents/GitHub/Panel/'
dotenv.config({ path: path.join(projectPath, '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  console.log("Querying profiles directly via anon key...")
  const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'miguel.torres@margube.com')
      .single()
  
  if (error) {
     console.log('Result ERROR:', error)
  } else {
     console.log('Result DATA password:', data.password_hash)
     const match = bcrypt.compareSync('Temp0001!', data.password_hash)
     console.log('Does it match Temp0001! ? ', match)
  }
}
test()
