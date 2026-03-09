import { createClient } from '@supabase/supabase-js';

// TODO: ユーザーから提供された実際のURLとキーに置き換える
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}
