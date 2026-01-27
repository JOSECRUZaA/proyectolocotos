
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://tjeormsfarjvrkabxrrw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqZW9ybXNmYXJqdnJrYWJ4cnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0ODcwNTMsImV4cCI6MjA4MzA2MzA1M30.QLB2sFFrJrBNf4y2rMZNEJYVdMgF5OnstGGErels0fI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    const { data: products, error } = await supabase
        .from('products')
        .select('id, nombre, foto_url')
        .not('foto_url', 'is', null);

    if (error) {
        fs.writeFileSync('verification_results.txt', `ERROR: ${error.message}`);
        return;
    }

    const all = products || [];
    const optimized = all.filter(p => p.foto_url && p.foto_url.includes('optimized_'));
    const unoptimized = all.filter(p => p.foto_url && !p.foto_url.includes('optimized_'));

    const output = `
--- VERIFICATION RESULTS ---
TOTAL: ${all.length}
OPTIMIZED: ${optimized.length}
UNOPTIMIZED: ${unoptimized.length}
----------------------------
  `;

    fs.writeFileSync('verification_results.txt', output);
}

verify();
