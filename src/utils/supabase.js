import { createClient } from '@supabase/supabase-js';

// TODO: ユーザーから提供された実際のURLとキーに置き換える
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://evwktwnunathvgrhuyst.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2d2t0d251bmF0aHZncmh1eXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMzAzODAsImV4cCI6MjA4ODYwNjM4MH0.-_rotYbr24D9wdKntFO_9v2_rn0thhYJ4SAVRYX-_xE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}
