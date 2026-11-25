-- Migration 008
-- Create configurable community rules

CREATE TABLE community_settings (
    community_id UUID PRIMARY KEY,

    membership_requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    allow_member_invites BOOLEAN NOT NULL DEFAULT FALSE,

    contribution_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    contribution_amount NUMERIC(18, 2),
    contribution_currency CHAR(3) NOT NULL DEFAULT 'ETB',
    contribution_frequency VARCHAR(32),

    contribution_due_day SMALLINT,
    grace_period_days INTEGER NOT NULL DEFAULT 0,

    late_penalty_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    late_penalty_type VARCHAR(32),
    late_penalty_amount NUMERIC(18, 2),

    attendance_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    voting_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    notification_settings JSONB NOT NULL DEFAULT '{}'::JSONB,
    custom_rules JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT community_settings_community_fk
        FOREIGN KEY (community_id)
        REFERENCES communities (id)
        ON DELETE CASCADE,

    CONSTRAINT community_settings_amount_check
        CHECK (
            contribution_amount IS NULL
            OR contribution_amount >= 0
        ),

    CONSTRAINT community_settings_frequency_check
        CHECK (
            contribution_frequency IS NULL
            OR contribution_frequency IN (
                'daily',
                'weekly',
                'biweekly',
                'monthly',
                'quarterly',
                'yearly',
                'custom'
            )
        ),

    CONSTRAINT community_settings_due_day_check
        CHECK (
            contribution_due_day IS NULL
            OR contribution_due_day BETWEEN 1 AND 31
        ),

    CONSTRAINT community_settings_grace_period_check
        CHECK (grace_period_days >= 0),

    CONSTRAINT community_settings_penalty_type_check
        CHECK (
            late_penalty_type IS NULL
            OR late_penalty_type IN (
                'fixed',
                'percentage'
            )
        ),

    CONSTRAINT community_settings_penalty_amount_check
        CHECK (
            late_penalty_amount IS NULL
            OR late_penalty_amount >= 0
        ),

    CONSTRAINT community_settings_notification_object_check
        CHECK (
            jsonb_typeof(notification_settings) = 'object'
        ),

    CONSTRAINT community_settings_custom_rules_object_check
        CHECK (
            jsonb_typeof(custom_rules) = 'object'
        )
);

CREATE TRIGGER community_settings_set_updated_at
BEFORE UPDATE ON community_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
