import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env from root
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

const envConfig = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/['"]/g, ''); // Remove quotes if any
        envConfig[key] = value;
    }
});

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
    console.log('--- Checking Database State ---');

    console.log('\n1. Checking "cash_sessions" table...');
    const { data: sessions, error: sessionsError } = await supabase
        .from('cash_sessions')
        .select('*')
        .limit(1);

    if (sessionsError) {
        console.log('❌ "cash_sessions" table issue:', sessionsError.message);
        if (sessionsError.code === '42P01') console.log('   (Table does not exist)');
    } else {
        console.log('✅ "cash_sessions" table exists.');
    }

    console.log('\n2. Checking "products" table columns (stock_diario_base)...');
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('stock_diario_base')
        .limit(1);

    if (productsError) {
        console.log('❌ "products" column issue:', productsError.message);
        if (productsError.message.includes('column "stock_diario_base" does not exist')) {
            console.log('   Column "stock_diario_base" is MISSING.');
        }
    } else {
        console.log('✅ "stock_diario_base" column exists.');
    }

    console.log('\n3. Checking "products" table columns (prioridad)...');
    const { data: productsPrio, error: prioError } = await supabase
        .from('products')
        .select('prioridad')
        .limit(1);

    if (prioError) {
        console.log('❌ "products" column issue:', prioError.message);
    } else {
        console.log('✅ "prioridad" column exists.');
    }
}

checkDatabase();
