-- Create a second customer for IDOR testing
DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email = 'customer2.test@nova-store.dev';
  IF v_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      is_sso_user, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      'customer2.test@nova-store.dev',
      extensions.crypt('NovaTest2026!', extensions.gen_salt('bf', 10)),
      now(),
      '{"role": "customer"}'::jsonb,
      '{"full_name": "Test Customer 2"}'::jsonb,
      false, now(), now()
    )
    RETURNING id INTO v_id;
  END IF;
END $$;
