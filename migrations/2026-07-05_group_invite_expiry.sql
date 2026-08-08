-- ============================================================================
-- Group invite: rotate + optional expiry
--
-- Adds a per-group invite expiry and a way to rotate (reset) the invite token:
--   * invite_token_expires_at — NULL means "never expires" (the default, so
--     every existing group keeps working unchanged). When set, joins are
--     rejected once now() passes it.
--   * join_group_by_token now rejects an expired token.
--   * reset_group_invite(_group_id, _ttl_seconds) — admin-only. Generates a
--     fresh token (killing the old QR/link) and optionally sets an expiry
--     _ttl_seconds from now (NULL/0 = never). Returns the new token + expiry.
--
-- Safe to run more than once (IF NOT EXISTS / CREATE OR REPLACE guards).
-- ============================================================================

ALTER TABLE public.groups_tbl
  ADD COLUMN IF NOT EXISTS invite_token_expires_at timestamptz;

-- Reject an expired token (in addition to a missing/unknown one).
CREATE OR REPLACE FUNCTION public.join_group_by_token(_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_group uuid;
  v_phone text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _token IS NULL THEN RAISE EXCEPTION 'Invalid invite'; END IF;

  SELECT id INTO v_group
  FROM public.groups_tbl
  WHERE invite_token = _token
    AND (invite_token_expires_at IS NULL OR invite_token_expires_at > now())
  LIMIT 1;
  IF v_group IS NULL THEN RAISE EXCEPTION 'Invalid or expired invite'; END IF;

  -- Attach any phone-contact ghost(s) for this user first (claims globally by
  -- phone; if a ghost was in this group it becomes the user's membership).
  SELECT phone INTO v_phone FROM public.users_tbl WHERE id = v_uid;
  IF v_phone IS NOT NULL AND length(trim(v_phone)) > 0 THEN
    PERFORM public.claim_placeholder(v_phone);
  END IF;

  -- Add as a member if not already one (unique group_id+member_id).
  INSERT INTO public.group_members_tbl (group_id, member_id)
  VALUES (v_group, v_uid)
  ON CONFLICT (group_id, member_id) DO NOTHING;

  RETURN v_group;
END;
$$;

-- Rotate the invite token (admin only), optionally with an expiry.
CREATE OR REPLACE FUNCTION public.reset_group_invite(
  _group_id uuid,
  _ttl_seconds integer DEFAULT NULL
)
RETURNS TABLE (invite_token uuid, invite_token_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_new_token uuid := gen_random_uuid();
  v_expires timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_group_admin(_group_id, v_uid) THEN
    RAISE EXCEPTION 'Only the group admin can reset the invite';
  END IF;

  IF _ttl_seconds IS NOT NULL AND _ttl_seconds > 0 THEN
    v_expires := now() + make_interval(secs => _ttl_seconds);
  ELSE
    v_expires := NULL;
  END IF;

  UPDATE public.groups_tbl g
     SET invite_token = v_new_token,
         invite_token_expires_at = v_expires
   WHERE g.id = _group_id;

  RETURN QUERY SELECT v_new_token, v_expires;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_group_invite(uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reset_group_invite(uuid, integer) TO authenticated;
