import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function setup() {
  // Add Customer Ctm1 if not exists
  console.log('Seeding customer...');
  const { data: existing, error: findErr } = await supabase.from('Customer').select('id').eq('name', 'Ctm1');
  let customerId;
  if (!existing || existing.length === 0) {
    const { data: cust, error: insErr } = await supabase.from('Customer').insert({
      name: 'Ctm1',
      pasword: '919&',
      email: 'ctm1@test.com'
    }).select();
    if (insErr) console.error('Insert customer error:', insErr);
    else customerId = cust[0].id;
  } else {
    customerId = existing[0].id;
    await supabase.from('Customer').update({ pasword: '919&' }).eq('id', customerId);
  }
  
  console.log('Customer seeded:', customerId);
}
setup();
