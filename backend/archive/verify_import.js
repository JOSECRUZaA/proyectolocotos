
import { createClient } from '@supabase/supabase-js';

// process.env will be populated by --env-file

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    console.log('Env keys available:', Object.keys(process.env).filter(k => k.startsWith('VITE_')));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log('--- Verifying Product Import ---');

    const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error counting products:', error);
        return;
    }

    console.log(`Total Products in DB: ${count}`);

    // Check for specific new product
    const { data, error: searchError } = await supabase
        .from('products')
        .select('id, nombre, precio, area')
        .eq('nombre', 'Chicharrón de Cola de Lagarto');

    if (searchError) {
        console.error('Error searching specific product:', searchError);
    } else if (data.length > 0) {
        console.log('✅ Found "Chicharrón de Cola de Lagarto" - Price:', data[0].precio);
    } else {
        console.log('❌ "Chicharrón de Cola de Lagarto" NOT FOUND.');
    }

    // List a few recent
    const { data: recent } = await supabase
        .from('products')
        .select('nombre, precio')
        .order('id', { ascending: false })
        .limit(5);

    console.log('\nLast 5 Products added:');
    recent?.forEach(p => console.log(`- ${p.nombre} (${p.precio})`));
}

verify();
