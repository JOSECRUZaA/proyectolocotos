import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tjeormsfarjvrkabxrrw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqZW9ybXNmYXJqdnJrYWJ4cnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0ODcwNTMsImV4cCI6MjA4MzA2MzA1M30.QLB2sFFrJrBNf4y2rMZNEJYVdMgF5OnstGGErels0fI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function invalidate() {
    console.log('Invalidating session for admin_recuperacion@wendys.com...');

    // 1. Get User ID
    const { data: users, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', 'admin_recuperacion@wendys.com')
        .single();

    if (userError) {
        console.error('Error finding user:', userError);
        return;
    }

    const userId = users.id;
    console.log('User ID:', userId);

    // 2. Update Session ID to random value
    const newSessionId = crypto.randomUUID();
    console.log('Setting new remote session ID:', newSessionId);

    const { error: updateError } = await supabase
        .from('profiles')
        .update({ current_session_id: newSessionId } as any)
        .eq('id', userId);

    if (updateError) {
        console.error('Error updating session:', updateError);
    } else {
        console.log('SUCCESS: Session invalidated. The client should log out shortly.');
    }
}

invalidate();
