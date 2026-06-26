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
