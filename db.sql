-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.expense_payers_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expense_id uuid NOT NULL,
  payer_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT '0'::numeric,
  CONSTRAINT expense_payers_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT expense_payers_tbl_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.expenses_tbl(id),
  CONSTRAINT expense_payers_tbl_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES public.users_tbl(id)
);
CREATE TABLE public.expenses_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  group_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT '0'::numeric,
  description text NOT NULL,
  expense_date timestamp with time zone NOT NULL DEFAULT now(),
  proof_of_payment text,
  split_type text NOT NULL,
  currency text NOT NULL DEFAULT 'PHP'::text,
  status text NOT NULL DEFAULT 'ongoing'::text,
  CONSTRAINT expenses_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_tbl_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users_tbl(id),
  CONSTRAINT expenses_tbl_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups_tbl(id)
);
CREATE TABLE public.group_members_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  group_id uuid NOT NULL,
  member_id uuid NOT NULL,
  CONSTRAINT group_members_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT group_members_tbl_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups_tbl(id),
  CONSTRAINT group_members_tbl_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.users_tbl(id)
);
CREATE TABLE public.groups_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  admin_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  avatar text,
  archived boolean NOT NULL DEFAULT false,
  CONSTRAINT groups_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT groups_tbl_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users_tbl(id)
);
CREATE TABLE public.member_splits_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expense_id uuid NOT NULL,
  member_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT '0'::numeric,
  percentage numeric NOT NULL DEFAULT '0'::numeric,
  CONSTRAINT member_splits_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT member_splits_tbl_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.expenses_tbl(id),
  CONSTRAINT member_splits_tbl_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.users_tbl(id)
);
CREATE TABLE public.notifications_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  type text NOT NULL,
  reference_id uuid NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  CONSTRAINT notifications_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_tbl_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.users_tbl(id),
  CONSTRAINT notifications_tbl_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.users_tbl(id)
);
CREATE TABLE public.payment_splits_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  group_id uuid NOT NULL,
  expense_id uuid NOT NULL,
  member_id uuid NOT NULL,
  payer_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT '0'::numeric,
  proof_of_payment text,
  member_note text,
  payer_note text,
  status text NOT NULL DEFAULT 'pending'::text,
  status_updated_at timestamp with time zone,
  CONSTRAINT payment_splits_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT payment_splits_tbl_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES public.users_tbl(id),
  CONSTRAINT payment_splits_tbl_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.expenses_tbl(id),
  CONSTRAINT payment_splits_tbl_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups_tbl(id),
  CONSTRAINT payment_splits_tbl_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.users_tbl(id)
);
CREATE TABLE public.user_favorites_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  favorite_id uuid NOT NULL,
  CONSTRAINT user_favorites_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT user_favorites_tbl_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_tbl(id),
  CONSTRAINT user_favorites_tbl_favorite_id_fkey FOREIGN KEY (favorite_id) REFERENCES public.users_tbl(id)
);
CREATE TABLE public.user_preferences_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL UNIQUE,
  default_currency text NOT NULL DEFAULT 'PHP'::text,
  appearance text NOT NULL DEFAULT 'light'::text,
  notif_settlement_request boolean NOT NULL DEFAULT true,
  notif_settlement_approved boolean NOT NULL DEFAULT true,
  notif_settlement_rejected boolean NOT NULL,
  notif_settlement_completed boolean NOT NULL,
  notif_expense_inclusion boolean NOT NULL,
  notif_group_join boolean NOT NULL,
  notif_group_leave boolean NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_preferences_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT user_preferences_tbl_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_tbl(id)
);
CREATE TABLE public.user_push_tokens_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  CONSTRAINT user_push_tokens_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT user_push_tokens_tbl_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_tbl(id)
);
CREATE TABLE public.users_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  email text NOT NULL UNIQUE,
  phone text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  avatar text,
  archived boolean NOT NULL DEFAULT false,
  plan text NOT NULL DEFAULT 'free'::text,
  plan_expires_at timestamp with time zone,
  CONSTRAINT users_tbl_pkey PRIMARY KEY (id)
);
-- Required for account deletion (called via supabase.rpc('delete_user'))
-- Run this in your Supabase SQL Editor.
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.users_tbl WHERE id = auth.uid();
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
-- Run this whole section in the Supabase SQL Editor. It is idempotent
-- (safe to re-run). Policies are scoped to the `authenticated` role;
-- the `service_role` (used by Edge Functions / server code) bypasses
-- RLS automatically.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions
-- SECURITY DEFINER + ownership by `postgres` means these bypass RLS,
-- which is what breaks the infinite recursion you'd otherwise hit when
-- a group_members policy needs to read group_members. auth.uid() still
-- reflects the calling user (it reads the request JWT, not the role).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_group_member(
  _group_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members_tbl
    WHERE group_id = _group_id AND member_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(
  _group_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups_tbl
    WHERE id = _group_id AND admin_id = _user_id
  );
$$;

-- Membership check for a row that belongs to an expense (payers, splits).
CREATE OR REPLACE FUNCTION public.can_access_expense(
  _expense_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.expenses_tbl e
    JOIN public.group_members_tbl gm ON gm.group_id = e.group_id
    WHERE e.id = _expense_id AND gm.member_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_expense(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_expense(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- users_tbl
-- SELECT is open to any authenticated user because adding members to a
-- group relies on searching all users by name/email (searchUsers).
-- Writes are restricted to your own row. Deletes go through the
-- delete_user() SECURITY DEFINER function only.
-- ---------------------------------------------------------------------
ALTER TABLE public.users_tbl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_authenticated" ON public.users_tbl;
CREATE POLICY "users_select_authenticated" ON public.users_tbl
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "users_insert_self" ON public.users_tbl;
CREATE POLICY "users_insert_self" ON public.users_tbl
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users_update_self" ON public.users_tbl;
CREATE POLICY "users_update_self" ON public.users_tbl
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------
-- groups_tbl
-- ---------------------------------------------------------------------
ALTER TABLE public.groups_tbl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups_select_members" ON public.groups_tbl;
CREATE POLICY "groups_select_members" ON public.groups_tbl
  FOR SELECT TO authenticated
  USING (admin_id = auth.uid() OR public.is_group_member(id));

DROP POLICY IF EXISTS "groups_insert_admin" ON public.groups_tbl;
CREATE POLICY "groups_insert_admin" ON public.groups_tbl
  FOR INSERT TO authenticated WITH CHECK (admin_id = auth.uid());

-- Only the current admin can update; the new admin_id (on transfer) must
-- be an existing member so a group can't be orphaned to an outsider.
DROP POLICY IF EXISTS "groups_update_admin" ON public.groups_tbl;
CREATE POLICY "groups_update_admin" ON public.groups_tbl
  FOR UPDATE TO authenticated
  USING (admin_id = auth.uid())
  WITH CHECK (public.is_group_member(id, admin_id));

DROP POLICY IF EXISTS "groups_delete_admin" ON public.groups_tbl;
CREATE POLICY "groups_delete_admin" ON public.groups_tbl
  FOR DELETE TO authenticated USING (admin_id = auth.uid());

-- ---------------------------------------------------------------------
-- group_members_tbl
-- ---------------------------------------------------------------------
ALTER TABLE public.group_members_tbl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_same_group" ON public.group_members_tbl;
CREATE POLICY "members_select_same_group" ON public.group_members_tbl
  FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR public.is_group_member(group_id));

-- Admin can add members; a user can add themselves (invite-link join).
DROP POLICY IF EXISTS "members_insert_admin_or_self" ON public.group_members_tbl;
CREATE POLICY "members_insert_admin_or_self" ON public.group_members_tbl
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(group_id) OR member_id = auth.uid());

-- Admin can remove members; a user can remove themselves (leave group).
DROP POLICY IF EXISTS "members_delete_admin_or_self" ON public.group_members_tbl;
CREATE POLICY "members_delete_admin_or_self" ON public.group_members_tbl
  FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id) OR member_id = auth.uid());

-- ---------------------------------------------------------------------
-- expenses_tbl
-- ---------------------------------------------------------------------
ALTER TABLE public.expenses_tbl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select_members" ON public.expenses_tbl;
CREATE POLICY "expenses_select_members" ON public.expenses_tbl
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "expenses_insert_member_creator" ON public.expenses_tbl;
CREATE POLICY "expenses_insert_member_creator" ON public.expenses_tbl
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid() AND public.is_group_member(group_id));

-- Any group member can update (settlement flow flips expense status).
DROP POLICY IF EXISTS "expenses_update_members" ON public.expenses_tbl;
CREATE POLICY "expenses_update_members" ON public.expenses_tbl
  FOR UPDATE TO authenticated
  USING (public.is_group_member(group_id))
  WITH CHECK (public.is_group_member(group_id));

DROP POLICY IF EXISTS "expenses_delete_creator_or_admin" ON public.expenses_tbl;
CREATE POLICY "expenses_delete_creator_or_admin" ON public.expenses_tbl
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid() OR public.is_group_admin(group_id));

-- ---------------------------------------------------------------------
-- expense_payers_tbl  (child of an expense)
-- ---------------------------------------------------------------------
ALTER TABLE public.expense_payers_tbl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payers_select_members" ON public.expense_payers_tbl;
CREATE POLICY "payers_select_members" ON public.expense_payers_tbl
  FOR SELECT TO authenticated USING (public.can_access_expense(expense_id));

DROP POLICY IF EXISTS "payers_insert_members" ON public.expense_payers_tbl;
CREATE POLICY "payers_insert_members" ON public.expense_payers_tbl
  FOR INSERT TO authenticated WITH CHECK (public.can_access_expense(expense_id));

DROP POLICY IF EXISTS "payers_delete_members" ON public.expense_payers_tbl;
CREATE POLICY "payers_delete_members" ON public.expense_payers_tbl
  FOR DELETE TO authenticated USING (public.can_access_expense(expense_id));

-- ---------------------------------------------------------------------
-- member_splits_tbl  (child of an expense)
-- ---------------------------------------------------------------------
ALTER TABLE public.member_splits_tbl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "splits_select_members" ON public.member_splits_tbl;
CREATE POLICY "splits_select_members" ON public.member_splits_tbl
  FOR SELECT TO authenticated USING (public.can_access_expense(expense_id));

DROP POLICY IF EXISTS "splits_insert_members" ON public.member_splits_tbl;
CREATE POLICY "splits_insert_members" ON public.member_splits_tbl
  FOR INSERT TO authenticated WITH CHECK (public.can_access_expense(expense_id));

DROP POLICY IF EXISTS "splits_delete_members" ON public.member_splits_tbl;
CREATE POLICY "splits_delete_members" ON public.member_splits_tbl
  FOR DELETE TO authenticated USING (public.can_access_expense(expense_id));

-- ---------------------------------------------------------------------
-- payment_splits_tbl  (settlements between a payer and a member)
-- ---------------------------------------------------------------------
ALTER TABLE public.payment_splits_tbl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_members" ON public.payment_splits_tbl;
CREATE POLICY "payments_select_members" ON public.payment_splits_tbl
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "payments_insert_members" ON public.payment_splits_tbl;
CREATE POLICY "payments_insert_members" ON public.payment_splits_tbl
  FOR INSERT TO authenticated WITH CHECK (public.is_group_member(group_id));

-- Only the two parties to a settlement can change its status.
DROP POLICY IF EXISTS "payments_update_parties" ON public.payment_splits_tbl;
CREATE POLICY "payments_update_parties" ON public.payment_splits_tbl
  FOR UPDATE TO authenticated
  USING (member_id = auth.uid() OR payer_id = auth.uid())
  WITH CHECK (member_id = auth.uid() OR payer_id = auth.uid());

DROP POLICY IF EXISTS "payments_delete_members" ON public.payment_splits_tbl;
CREATE POLICY "payments_delete_members" ON public.payment_splits_tbl
  FOR DELETE TO authenticated USING (public.is_group_member(group_id));

-- ---------------------------------------------------------------------
-- notifications_tbl
-- ---------------------------------------------------------------------
ALTER TABLE public.notifications_tbl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_recipient" ON public.notifications_tbl;
CREATE POLICY "notifications_select_recipient" ON public.notifications_tbl
  FOR SELECT TO authenticated USING (to_user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_sender" ON public.notifications_tbl;
CREATE POLICY "notifications_insert_sender" ON public.notifications_tbl
  FOR INSERT TO authenticated WITH CHECK (from_user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_recipient" ON public.notifications_tbl;
CREATE POLICY "notifications_update_recipient" ON public.notifications_tbl
  FOR UPDATE TO authenticated
  USING (to_user_id = auth.uid()) WITH CHECK (to_user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_recipient" ON public.notifications_tbl;
CREATE POLICY "notifications_delete_recipient" ON public.notifications_tbl
  FOR DELETE TO authenticated USING (to_user_id = auth.uid());

-- ---------------------------------------------------------------------
-- user_favorites_tbl
-- ---------------------------------------------------------------------
ALTER TABLE public.user_favorites_tbl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorites_select_own" ON public.user_favorites_tbl;
CREATE POLICY "favorites_select_own" ON public.user_favorites_tbl
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "favorites_insert_own" ON public.user_favorites_tbl;
CREATE POLICY "favorites_insert_own" ON public.user_favorites_tbl
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "favorites_delete_own" ON public.user_favorites_tbl;
CREATE POLICY "favorites_delete_own" ON public.user_favorites_tbl
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- user_preferences_tbl  (owner-only; cross-user reads for push now go
-- through the send-push Edge Function using the service role)
-- ---------------------------------------------------------------------
ALTER TABLE public.user_preferences_tbl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "preferences_select_own" ON public.user_preferences_tbl;
CREATE POLICY "preferences_select_own" ON public.user_preferences_tbl
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "preferences_insert_own" ON public.user_preferences_tbl;
CREATE POLICY "preferences_insert_own" ON public.user_preferences_tbl
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "preferences_update_own" ON public.user_preferences_tbl;
CREATE POLICY "preferences_update_own" ON public.user_preferences_tbl
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- user_push_tokens_tbl  (owner-only; the send-push Edge Function reads
-- recipients' tokens with the service role)
-- ---------------------------------------------------------------------
ALTER TABLE public.user_push_tokens_tbl ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_tokens_select_own" ON public.user_push_tokens_tbl;
CREATE POLICY "push_tokens_select_own" ON public.user_push_tokens_tbl
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_tokens_insert_own" ON public.user_push_tokens_tbl;
CREATE POLICY "push_tokens_insert_own" ON public.user_push_tokens_tbl
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_tokens_delete_own" ON public.user_push_tokens_tbl;
CREATE POLICY "push_tokens_delete_own" ON public.user_push_tokens_tbl
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- A device's Expo push token must belong to exactly one user. The client
-- can no longer delete other users' token rows under RLS, so enforce it
-- here: registering a token detaches it from any previous owner (handles
-- the shared-device / account-switch case).
CREATE OR REPLACE FUNCTION public.dedupe_push_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_push_tokens_tbl
  WHERE token = NEW.token AND user_id <> NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dedupe_push_token_trigger ON public.user_push_tokens_tbl;
CREATE TRIGGER dedupe_push_token_trigger
  BEFORE INSERT ON public.user_push_tokens_tbl
  FOR EACH ROW EXECUTE FUNCTION public.dedupe_push_token();
