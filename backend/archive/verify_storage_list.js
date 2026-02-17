
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyStorage() {
    console.log('--- Verifying Storage Bucket via List ---');

    // Attempt to list files (even empty)
    const { data, error } = await supabase
        .storage
        .from('products')
        .list();

    if (error) {
        console.error('❌ Error Listing Bucket:', error.message);
    } else {
        console.log('✅ Bucket "products" appears accessible!');
        console.log(`   Found ${data.length} files.`);
    }
}

verifyStorage();
