-- Migration 019
-- Track notification delivery attempts by channel

CREATE TABLE notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    notification_id UUID NOT NULL,

    channel VARCHAR(32) NOT NULL,

    status VARCHAR(32) NOT NULL DEFAULT 'pending',

    provider VARCHAR(64),
    provider_message_id VARCHAR(255),

    attempt_count INTEGER NOT NULL DEFAULT 0,

    queued_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,

    failure_reason TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT notification_deliveries_notification_fk
        FOREIGN KEY (notification_id)
        REFERENCES notifications (id)
        ON DELETE CASCADE,

    CONSTRAINT notification_deliveries_channel_check
        CHECK (
            channel IN (
                'in_app',
                'email',
                'sms'
            )
        ),

    CONSTRAINT notification_deliveries_status_check
        CHECK (
            status IN (
                'pending',
                'queued',
                'sent',
                'delivered',
                'failed'
            )
        ),

    CONSTRAINT notification_deliveries_attempt_count_check
        CHECK (attempt_count >= 0),

    CONSTRAINT notification_deliveries_metadata_object_check
        CHECK (
            jsonb_typeof(metadata) = 'object'
        ),

    CONSTRAINT notification_deliveries_channel_unique
        UNIQUE (notification_id, channel)
);

CREATE INDEX notification_deliveries_notification_idx
    ON notification_deliveries (notification_id);

CREATE INDEX notification_deliveries_status_idx
    ON notification_deliveries (status, created_at);

CREATE INDEX notification_deliveries_provider_message_idx
    ON notification_deliveries (provider, provider_message_id)
    WHERE provider_message_id IS NOT NULL;

CREATE TRIGGER notification_deliveries_set_updated_at
BEFORE UPDATE ON notification_deliveries
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
