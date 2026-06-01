-- Update a user to admin role in Supabase
-- Replace 'user@example.com' with the target user's email

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'user@example.com';