-- 1. Enable pgcrypto if not already enabled (pre-installed in extensions schema)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Create the multi-tenant WABA connections table
CREATE TABLE IF NOT EXISTS public.waba_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pod_id UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    phone_number_id VARCHAR(255) UNIQUE NOT NULL,
    waba_id VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    encrypted_system_user_token BYTEA NOT NULL, -- Encrypted binary data
    waba_status VARCHAR(50) DEFAULT 'pending', -- pending, active, disconnected
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on waba_connections
ALTER TABLE public.waba_connections ENABLE ROW LEVEL SECURITY;

-- Dynamic tenant isolation policy
CREATE POLICY "Allow pod authenticated select" ON public.waba_connections
    FOR SELECT
    TO authenticated
    USING (
        auth.jwt() ->> 'pod_id' = pod_id::text
    );

CREATE POLICY "Allow pod authenticated insert" ON public.waba_connections
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.jwt() ->> 'pod_id' = pod_id::text
    );

CREATE POLICY "Allow pod authenticated update" ON public.waba_connections
    FOR UPDATE
    TO authenticated
    USING (
        auth.jwt() ->> 'pod_id' = pod_id::text
    );

-- Create index for quick routing in webhook lookups
CREATE INDEX IF NOT EXISTS idx_waba_connections_phone_number_id ON public.waba_connections(phone_number_id);

-- 3. Create the WhatsApp billing logs table to track Meta OBO conversation metrics
CREATE TABLE IF NOT EXISTS public.whatsapp_billing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    waba_id VARCHAR(255) NOT NULL,
    phone_number_id VARCHAR(255) NOT NULL,
    conversation_id VARCHAR(255) UNIQUE NOT NULL,
    pricing_category VARCHAR(50) NOT NULL, -- marketing, service, utility, authentication
    cost NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    billable BOOLEAN DEFAULT TRUE,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on billing logs
ALTER TABLE public.whatsapp_billing_logs ENABLE ROW LEVEL SECURITY;

-- 4. Dynamic Credential Cryptography functions
-- Encrypts a text token using a system-level secret passphrase
CREATE OR REPLACE FUNCTION public.encrypt_waba_token(token TEXT, secret_key TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN extensions.pgp_sym_encrypt(token, secret_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrypts an encrypted token back into plain text
CREATE OR REPLACE FUNCTION public.decrypt_waba_token(encrypted_token BYTEA, secret_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN extensions.pgp_sym_decrypt(encrypted_token, secret_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Helper function to decrypt a tenant's WABA connection details by phone_number_id
CREATE OR REPLACE FUNCTION public.decrypt_tenant_waba_connection(p_phone_number_id TEXT, p_secret_key TEXT)
RETURNS TABLE (
    pod_id UUID,
    entity_id UUID,
    decrypted_token TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wc.pod_id,
        wc.entity_id,
        public.decrypt_waba_token(wc.encrypted_system_user_token, p_secret_key) AS decrypted_token
    FROM public.waba_connections wc
    WHERE wc.phone_number_id = p_phone_number_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

