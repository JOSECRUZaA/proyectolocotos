
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyStorage() {
    console.log('--- Verifying Storage Bucket ---');

    // Attempt to get the bucket details
    const { data, error } = await supabase
        .storage
        .getBucket('products');

    if (error) {
        console.error('❌ Error Accessing Bucket:', error.message);
        if (error.message.includes('not found')) {
            console.error('   -> Did you run the SQL script?');
        }
    } else {
        console.log('✅ Bucket "products" FOUND!');
        console.log('   Public:', data.public);
        console.log('   Created At:', data.created_at);
    }
}

verifyStorage();
