-- Migration 002
-- Create users, user profiles, and external identity records

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email VARCHAR(255),
    phone VARCHAR(32),

    password_hash TEXT,

    status VARCHAR(32) NOT NULL DEFAULT 'active',

    email_verified_at TIMESTAMPTZ,
    phone_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT users_status_check
        CHECK (status IN ('active', 'suspended', 'deactivated')),

    CONSTRAINT users_contact_check
        CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE UNIQUE INDEX users_email_unique_idx
    ON users (LOWER(email))
    WHERE email IS NOT NULL
      AND deleted_at IS NULL;

CREATE UNIQUE INDEX users_phone_unique_idx
    ON users (phone)
    WHERE phone IS NOT NULL
      AND deleted_at IS NULL;


CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY,

    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,

    display_name VARCHAR(200),
    avatar_url TEXT,

    preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Addis_Ababa',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_profiles_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
);


CREATE TABLE identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    provider VARCHAR(50) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,

    verification_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    verified_at TIMESTAMPTZ,

    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT identities_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,

    CONSTRAINT identities_verification_status_check
        CHECK (
            verification_status IN (
                'pending',
                'verified',
                'failed',
                'revoked'
            )
        ),

    CONSTRAINT identities_provider_subject_unique
        UNIQUE (provider, provider_subject)
);


CREATE INDEX identities_user_id_idx
    ON identities (user_id);

CREATE INDEX identities_provider_idx
    ON identities (provider);
