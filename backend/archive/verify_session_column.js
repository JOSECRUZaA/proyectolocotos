import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tjeormsfarjvrkabxrrw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqZW9ybXNmYXJqdnJrYWJ4cnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0ODcwNTMsImV4cCI6MjA4MzA2MzA1M30.QLB2sFFrJrBNf4y2rMZNEJYVdMgF5OnstGGErels0fI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verify() {
    console.log('Verifying current_session_id column...');

    const { data, error } = await supabase
        .from('profiles')
        .select('current_session_id')
        .limit(1);

    if (error) {
        console.error('Error verifying column:', error);
        if (error.message.includes('current_session_id') || error.code === '42703') {
            console.log('FAIL: Column current_session_id does not exist.');
        } else {
            console.log('UNKNOWN ERROR');
        }
    } else {
        console.log('SUCCESS: Column current_session_id exists.');
    }
}

verify();
