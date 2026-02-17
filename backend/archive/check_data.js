import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envConfig = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) envConfig[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function checkData() {
    console.log('--- Checking Data Consistency ---');

    // Check Payment Methods
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('metodo_pago')
        .limit(50); // Sample

    if (ordersError) console.error('Error fetching orders:', ordersError.message);
    else {
        const methods = [...new Set(orders.map(o => o.metodo_pago))];
        console.log('Distinct Payment Methods found:', methods);
    }

    // Check Cash Sessions
    const { data: sessions, error: sessionError } = await supabase
        .from('cash_sessions')
        .select('*')
        .limit(5);

    if (sessionError) console.error('Error fetching cash sessions:', sessionError.message);
    else {
        console.log(`Found ${sessions.length} cash sessions.`);
        if (sessions.length > 0) console.log('Sample Session:', sessions[0]);
    }
}

checkData();
