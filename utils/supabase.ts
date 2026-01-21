import { createClient } from '@supabase/supabase-js';
import 'expo-sqlite/localStorage/install';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SB_URL as string;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SB_API_KEY as string;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: Platform.OS !== 'web' ? localStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
