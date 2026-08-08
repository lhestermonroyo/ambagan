-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE dev.group_members_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  group_id uuid NOT NULL,
  member_id uuid NOT NULL,
  CONSTRAINT group_members_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT group_members_tbl_group_id_fkey FOREIGN KEY (group_id) REFERENCES dev.groups_tbl(id),
  CONSTRAINT group_members_tbl_member_id_fkey FOREIGN KEY (member_id) REFERENCES dev.users_tbl(id)
);
CREATE TABLE dev.notifications_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  type text NOT NULL,
  reference_id uuid NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  CONSTRAINT notifications_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_tbl_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES dev.users_tbl(id),
  CONSTRAINT notifications_tbl_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES dev.users_tbl(id)
);
CREATE TABLE dev.payment_splits_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  group_id uuid NOT NULL,
  expense_id uuid NOT NULL,
  member_id uuid,
  payer_id uuid,
  amount numeric NOT NULL DEFAULT '0'::numeric,
  proof_of_payment text,
  member_note text,
  payer_note text,
  status text NOT NULL DEFAULT 'pending'::text,
  status_updated_at timestamp with time zone,
  requested_at timestamp with time zone,
  settled_at timestamp with time zone,
  rejected_at timestamp with time zone,
  CONSTRAINT payment_splits_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT payment_splits_tbl_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES dev.expenses_tbl(id),
  CONSTRAINT payment_splits_tbl_group_id_fkey FOREIGN KEY (group_id) REFERENCES dev.groups_tbl(id),
  CONSTRAINT payment_splits_tbl_member_id_fkey FOREIGN KEY (member_id) REFERENCES dev.users_tbl(id),
  CONSTRAINT payment_splits_tbl_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES dev.users_tbl(id)
);
CREATE TABLE dev.groups_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  admin_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general'::text,
  avatar text,
  archived boolean NOT NULL DEFAULT false,
  invite_token uuid NOT NULL DEFAULT gen_random_uuid(),
  invite_token_expires_at timestamp with time zone,
  currency text NOT NULL DEFAULT 'PHP'::text,
  CONSTRAINT groups_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT groups_tbl_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES dev.users_tbl(id)
);
CREATE TABLE dev.user_push_tokens_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  CONSTRAINT user_push_tokens_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT user_push_tokens_tbl_user_id_fkey FOREIGN KEY (user_id) REFERENCES dev.users_tbl(id)
);
CREATE TABLE dev.expenses_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  group_id uuid NOT NULL,
  creator_id uuid,
  amount numeric NOT NULL DEFAULT '0'::numeric,
  description text NOT NULL,
  expense_date timestamp with time zone NOT NULL DEFAULT now(),
  proof_of_payment text,
  split_type text NOT NULL,
  currency text NOT NULL DEFAULT 'PHP'::text,
  status text NOT NULL DEFAULT 'ongoing'::text,
  is_draft boolean NOT NULL DEFAULT false,
  recurring_id uuid,
  category text NOT NULL DEFAULT 'general'::text,
  CONSTRAINT expenses_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_tbl_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES dev.users_tbl(id),
  CONSTRAINT expenses_tbl_group_id_fkey FOREIGN KEY (group_id) REFERENCES dev.groups_tbl(id),
  CONSTRAINT expenses_tbl_recurring_id_fkey FOREIGN KEY (recurring_id) REFERENCES dev.recurring_expenses_tbl(id)
);
CREATE TABLE dev.expense_payers_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expense_id uuid NOT NULL,
  payer_id uuid,
  amount numeric NOT NULL DEFAULT '0'::numeric,
  CONSTRAINT expense_payers_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT expense_payers_tbl_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES dev.expenses_tbl(id),
  CONSTRAINT expense_payers_tbl_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES dev.users_tbl(id)
);
CREATE TABLE dev.users_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  email text UNIQUE,
  phone text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  avatar text,
  archived boolean NOT NULL DEFAULT false,
  plan text NOT NULL DEFAULT 'free'::text,
  plan_expires_at timestamp with time zone DEFAULT now(),
  is_placeholder boolean NOT NULL DEFAULT false,
  CONSTRAINT users_tbl_pkey PRIMARY KEY (id)
);
CREATE TABLE dev.user_favorites_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  favorite_id uuid NOT NULL,
  CONSTRAINT user_favorites_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT user_favorites_tbl_favorite_id_fkey FOREIGN KEY (favorite_id) REFERENCES dev.users_tbl(id),
  CONSTRAINT user_favorites_tbl_user_id_fkey FOREIGN KEY (user_id) REFERENCES dev.users_tbl(id)
);
CREATE TABLE dev.user_preferences_tbl (
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
  settlement_view text NOT NULL DEFAULT 'full'::text,
  hero_view text NOT NULL DEFAULT 'balance'::text CHECK (hero_view = ANY (ARRAY['balance'::text, 'personal'::text])),
  notif_recurring_expense boolean NOT NULL DEFAULT true,
  CONSTRAINT user_preferences_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT user_preferences_tbl_user_id_fkey FOREIGN KEY (user_id) REFERENCES dev.users_tbl(id)
);
CREATE TABLE dev.member_splits_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expense_id uuid NOT NULL,
  member_id uuid,
  amount numeric NOT NULL DEFAULT '0'::numeric,
  percentage numeric NOT NULL DEFAULT '0'::numeric,
  CONSTRAINT member_splits_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT member_splits_tbl_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES dev.expenses_tbl(id),
  CONSTRAINT member_splits_tbl_member_id_fkey FOREIGN KEY (member_id) REFERENCES dev.users_tbl(id)
);
CREATE TABLE dev.expense_creation_log_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT expense_creation_log_tbl_pkey PRIMARY KEY (id)
);
CREATE TABLE dev.recurring_expenses_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  group_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text NOT NULL,
  currency text NOT NULL DEFAULT 'PHP'::text,
  split_type text NOT NULL,
  payers_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  splits_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  frequency text NOT NULL CHECK (frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text])),
  repeat_interval integer NOT NULL DEFAULT 1 CHECK (repeat_interval >= 1),
  start_date date NOT NULL,
  end_type text NOT NULL DEFAULT 'never'::text CHECK (end_type = ANY (ARRAY['never'::text, 'on_date'::text, 'after_count'::text])),
  end_date date,
  occurrence_limit integer,
  occurrences_count integer NOT NULL DEFAULT 0,
  next_run_at timestamp with time zone NOT NULL,
  last_run_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  category text NOT NULL DEFAULT 'general'::text,
  CONSTRAINT recurring_expenses_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT recurring_expenses_tbl_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES dev.users_tbl(id),
  CONSTRAINT recurring_expenses_tbl_group_id_fkey FOREIGN KEY (group_id) REFERENCES dev.groups_tbl(id)
);
CREATE TABLE dev.personal_books_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general'::text,
  avatar text,
  currency text NOT NULL DEFAULT 'PHP'::text,
  budget numeric CHECK (budget IS NULL OR budget > 0::numeric),
  archived boolean NOT NULL DEFAULT false,
  group_id uuid,
  budget_period text NOT NULL DEFAULT 'monthly'::text CHECK (budget_period = ANY (ARRAY['monthly'::text, 'total'::text])),
  default_expense_currency text CHECK (default_expense_currency IS NULL OR default_expense_currency ~ '^[A-Z]{3}$'::text),
  CONSTRAINT personal_books_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT personal_books_tbl_user_id_fkey FOREIGN KEY (user_id) REFERENCES dev.users_tbl(id),
  CONSTRAINT personal_books_tbl_group_id_fkey FOREIGN KEY (group_id) REFERENCES dev.groups_tbl(id)
);
CREATE TABLE dev.personal_expenses_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  book_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general'::text,
  currency text NOT NULL DEFAULT 'PHP'::text,
  expense_date timestamp with time zone NOT NULL DEFAULT now(),
  proof_of_payment text,
  recurring_id uuid,
  status text NOT NULL DEFAULT 'paid'::text CHECK (status = ANY (ARRAY['paid'::text, 'pending'::text])),
  CONSTRAINT personal_expenses_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT personal_expenses_tbl_book_id_fkey FOREIGN KEY (book_id) REFERENCES dev.personal_books_tbl(id),
  CONSTRAINT personal_expenses_tbl_user_id_fkey FOREIGN KEY (user_id) REFERENCES dev.users_tbl(id),
  CONSTRAINT personal_expenses_tbl_recurring_id_fkey FOREIGN KEY (recurring_id) REFERENCES dev.personal_recurring_tbl(id)
);
CREATE TABLE dev.personal_recurring_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  book_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general'::text,
  currency text NOT NULL DEFAULT 'PHP'::text,
  frequency text NOT NULL CHECK (frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text])),
  repeat_interval integer NOT NULL DEFAULT 1 CHECK (repeat_interval >= 1),
  start_date date NOT NULL,
  end_type text NOT NULL DEFAULT 'never'::text CHECK (end_type = ANY (ARRAY['never'::text, 'on_date'::text, 'after_count'::text])),
  end_date date,
  occurrence_limit integer,
  occurrences_count integer NOT NULL DEFAULT 0,
  next_run_at timestamp with time zone NOT NULL,
  last_run_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT personal_recurring_tbl_pkey PRIMARY KEY (id),
  CONSTRAINT personal_recurring_tbl_book_id_fkey FOREIGN KEY (book_id) REFERENCES dev.personal_books_tbl(id),
  CONSTRAINT personal_recurring_tbl_user_id_fkey FOREIGN KEY (user_id) REFERENCES dev.users_tbl(id)
);
CREATE TABLE dev.personal_expense_creation_log_tbl (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT personal_expense_creation_log_tbl_pkey PRIMARY KEY (id)
);
CREATE TABLE dev.fx_rates_tbl (
  currency text NOT NULL,
  php_per_unit numeric NOT NULL CHECK (php_per_unit > 0::numeric),
  as_of date NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fx_rates_tbl_pkey PRIMARY KEY (currency)
);
CREATE TABLE dev.fx_refresh_log_tbl (
  id bigint NOT NULL DEFAULT nextval('dev.fx_refresh_log_tbl_id_seq'::regclass),
  ran_at timestamp with time zone NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  status text NOT NULL,
  as_of date,
  updated_count integer,
  rejected jsonb,
  error text,
  CONSTRAINT fx_refresh_log_tbl_pkey PRIMARY KEY (id)
);