/*
# NOVA Store — Phase 2.75 Test Users

## Overview
Creates two real authenticated test accounts for development verification.

## Accounts
- Customer: customer.test@nova-store.dev / NovaTest2026!
- Admin: admin.test@nova-store.dev / NovaAdmin2026!

## Security
Passwords hashed with bcrypt (gen_salt('bf', 10)). Admin role set in
raw_app_meta_data (JWT-embedded, user-immutable) and mirrored in profiles.
The profiles_update_own RLS policy prevents self-escalation.
*/

DO $$
DECLARE
  v_customer_id uuid;
  v_admin_id uuid;
BEGIN
  -- Customer account (only if not already present)
  SELECT id INTO v_customer_id FROM auth.users WHERE email = 'customer.test@nova-store.dev';
  IF v_customer_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      is_sso_user, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      'customer.test@nova-store.dev',
      extensions.crypt('NovaTest2026!', extensions.gen_salt('bf', 10)),
      now(),
      '{"role": "customer"}'::jsonb,
      '{"full_name": "Test Customer"}'::jsonb,
      false, now(), now()
    )
    RETURNING id INTO v_customer_id;
  END IF;

  -- Admin account (only if not already present)
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin.test@nova-store.dev';
  IF v_admin_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      is_sso_user, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      'admin.test@nova-store.dev',
      extensions.crypt('NovaAdmin2026!', extensions.gen_salt('bf', 10)),
      now(),
      '{"role": "admin"}'::jsonb,
      '{"full_name": "Test Admin"}'::jsonb,
      false, now(), now()
    )
    RETURNING id INTO v_admin_id;
  END IF;

  -- Mirror admin role into profiles table
  UPDATE public.profiles
  SET role = 'admin'
  WHERE email = 'admin.test@nova-store.dev'
    AND role = 'customer';

END $$;
