
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
    console.log('--- Testing Storage Upload ---');

    // Create a dummy file buffer
    const fileContent = 'Hello World';

    // Login to get an authenticated user (Required for upload policy)
    // We'll use a known user or just try anon if policy allows (our policy requires auth)

    console.log('1. Attempting login to upload...');
    const { data: { user }, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'admin@wendy.com',
        password: 'password123'
    });

    if (loginError) {
        console.log('⚠️ Login failed (Using Anon):', loginError.message);
        // Try uploading as anon (will likely fail due to policy, but checks bucket existence)
    } else {
        console.log('✅ Logged in as:', user.email);
    }

    console.log('2. Uploading test file...');
    const { data, error } = await supabase
        .storage
        .from('products')
        .upload('test_file.txt', fileContent, {
            upsert: true
        });

    if (error) {
        console.error('❌ Upload Failed:', error);
        console.error('   Error Message:', error.message);
    } else {
        console.log('✅ Upload Successful!', data);

        // Clean up
        await supabase.storage.from('products').remove(['test_file.txt']);
    }
}

testUpload();
