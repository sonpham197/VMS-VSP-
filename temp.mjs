import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqfzpcuqzfpaernwydao.supabase.co';
const supabaseAnonKey = 'sb_publishable_-QHP-kzHCZI0qgj8Fi-e9w_KEPpxTCk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase.from('vessel_tracks').select('*').limit(1);
  console.log(data, error);
}

check();
