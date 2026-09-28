// Deterministic, non-secret values for unit tests. Real secrets never live in tests.
process.env.APP_SIGNING_SECRET ??= "test-signing-secret-0123456789abcdef-0123456789";
process.env.IP_HASH_SALT ??= "test-ip-hash-salt-0123";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "test-publishable-key-0123456789";
process.env.SUPABASE_SECRET_KEY ??= "test-secret-key-0123456789abcdef";
process.env.SANDBOX_WEBHOOK_SECRET ??= "test-sandbox-webhook-secret-0123";
