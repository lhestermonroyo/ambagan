import { tables } from "@/utils/constants";
import { supabase } from "@/utils/supabase";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";

export const isPhoneNumber = (input: string): boolean =>
  /^\+?[\d\s\-()]{7,15}$/.test(input.trim());

// Normalizes any PH phone input to the 10-digit local format stored in the DB (e.g. "9171234567")
export const normalizePhoneNumber = (input: string): string => {
  const digits = input.replace(/[\s\-()]/g, "").replace(/^\+/, "");
  if (digits.startsWith("63")) return digits.slice(2);
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
};

export const getEmailByPhone = async (phone: string): Promise<string | null> => {
  const normalized = normalizePhoneNumber(phone.trim());
  const { data } = await supabase
    .from(tables.USERS_TBL)
    .select("email")
    .eq("phone", normalized)
    .maybeSingle();
  return data?.email ?? null;
};

export const signUp = async ({
  email,
  password
}: {
  email: string;
  password: string;
}) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        email
      }
    }
  });

  if (error) throw error;
  return data;
};

export const loginWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
};

// Call once on app launch (see app/_layout.tsx) so the native Google SDK knows
// which OAuth clients to use. webClientId is what Supabase verifies the ID token
// against, so it must match a client registered under Supabase → Auth → Google.
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  });
};

// Native Google sign-in → Supabase session (no browser redirect). Returns null
// when the user dismisses the native picker (v13+ returns a "cancelled" type
// instead of throwing), so callers can treat null as "aborted, do nothing".
export const signInWithGoogle = async () => {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();

  if (response.type === "cancelled" || !response.data) {
    return null;
  }

  const idToken = response.data.idToken;
  if (!idToken) throw new Error("No ID token returned from Google");

  // NOTE: the GoogleSignIn iOS SDK embeds a `nonce` claim in this token, but the
  // RN wrapper never exposes the raw value, so we can't pass it to Supabase. That
  // triggers "Passed nonce and nonce in id_token should either both exist or not"
  // unless "Skip nonce checks" is enabled on the Supabase Google provider.
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken
  });
  if (error) throw error;
  return data;
};

// Native Sign in with Apple → Supabase session (iOS only). Apple returns the
// user's name ONLY on the first authorization and never inside the ID token, so
// we hand `fullName` back for onboarding to pre-fill. Cancellation throws with
// code "ERR_REQUEST_CANCELED" — callers swallow that.
export const signInWithApple = async () => {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL
    ]
  });

  if (!credential.identityToken) {
    throw new Error("No identity token returned from Apple");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken
  });
  if (error) throw error;

  return { data, fullName: credential.fullName };
};

export const logout = async () => {
  // Clear the cached Google account too, so the next Google sign-in shows the
  // account picker instead of silently reusing the last one. Best-effort — an
  // email/password or Apple user has no Google session, so ignore any error.
  try {
    await GoogleSignin.signOut();
  } catch {
    // no active Google session — nothing to clear
  }

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "ambagan://reset-password"
  });
  if (error) throw error;
};

export const setNewPassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
};

export const deleteAccount = async () => {
  const { error } = await supabase.rpc("delete_user");
  if (error) throw error;
};
