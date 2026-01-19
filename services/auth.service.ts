import { User } from '@/types/auth';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../utils/supabase';

export const signUp = async ({
  email,
  password,
  first_name,
  last_name
}: Pick<User, 'email' | 'first_name' | 'last_name'> & { password: string }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name,
        last_name
      }
    }
  });

  if (error) throw error;
  return data;
};

export const login = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
};

export const loginWithGoogle = async () => {
  const redirectTo = Linking.createURL('/');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo
    }
  });
  if (error) throw error;
  if (data?.url) {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    return result;
  }
  return data;
};
