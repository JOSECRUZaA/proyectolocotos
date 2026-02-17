
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
// Note: Using SERVICE_ROLE_KEY if available would be better to bypass RLS, 
// but usually we only have ANON in .env for frontend. 
// However, in this environment, I might not have the service key.
// Let's try to query public info. If I can't bypass RLS with anon, I'll rely on the fact 
// that I am running this in a "trusted" way, but wait, anon key obeys RLS.
// 
// If I really want to debug RLS, I should try to simulate the user login or just check if *any* public orders exist?
// Actually, let's just try to list *all* orders and see what happens (assuming there's a policy for anon or I can get a count).
//
// BUT, better approach: Use valid SQL via `run_command` interacting with the local DB if possible? 
// No, looking at `backend/` files, I see `check_db_state.js`.
//
// Let's try to read the .env file first to see what keys I have.

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
    console.log("Checking Orders...");

    // 1. Check Profiles
    const { data: profiles, error: errProfiles } = await supabase
        .from('profiles')
        .select('id, nombre_completo, rol')
        .limit(10);

    if (errProfiles) console.error("Error fetching profiles:", errProfiles);
    else {
        console.log("\n--- Profiles (Top 10) ---");
        console.table(profiles);
    }

    // 2. Check Orders (Count by Garzon)
    // This might fail if RLS blocks listing all orders for 'anon'. 
    // Usually 'orders' has "auth.role() = 'authenticated'". 
    // So 'anon' client won't see anything.

    console.log("\nNote: Validating via script with Anon Key might be blocked by RLS if not authenticated.");
}

checkOrders();
