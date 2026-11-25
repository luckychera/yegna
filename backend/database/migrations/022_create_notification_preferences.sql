-- Migration 022
-- Per-user notification preferences. One row per user; categories that are not
-- present in the JSON object use the default (enabled). Only the in-app channel
-- exists today, so a disabled category means no in-app notification is created.

CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY
        REFERENCES users (id)
        ON DELETE CASCADE,

    in_app JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT notification_preferences_in_app_object_check
        CHECK (jsonb_typeof(in_app) = 'object')
);

CREATE TRIGGER notification_preferences_set_updated_at
BEFORE UPDATE ON notification_preferences
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
