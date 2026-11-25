-- Migration 012
-- Create provider-independent payment transactions

CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    community_id UUID NOT NULL,
    user_id UUID NOT NULL,
    contribution_id UUID,

    provider VARCHAR(50) NOT NULL,
    provider_transaction_id VARCHAR(255),
    provider_reference VARCHAR(255),

    amount NUMERIC(18, 2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'ETB',

    status VARCHAR(32) NOT NULL DEFAULT 'pending',

    payment_method VARCHAR(50),

    checkout_url TEXT,

    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,

    failure_reason TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT payment_transactions_community_fk
        FOREIGN KEY (community_id)
        REFERENCES communities (id)
        ON DELETE CASCADE,

    CONSTRAINT payment_transactions_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE RESTRICT,

    CONSTRAINT payment_transactions_contribution_fk
        FOREIGN KEY (contribution_id)
        REFERENCES contributions (id)
        ON DELETE SET NULL,

    CONSTRAINT payment_transactions_amount_check
        CHECK (amount > 0),

    CONSTRAINT payment_transactions_currency_check
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT payment_transactions_status_check
        CHECK (
            status IN (
                'pending',
                'processing',
                'successful',
                'failed',
                'cancelled',
                'refunded'
            )
        ),

    CONSTRAINT payment_transactions_metadata_object_check
        CHECK (
            jsonb_typeof(metadata) = 'object'
        )
);


CREATE UNIQUE INDEX payment_transactions_provider_transaction_unique_idx
    ON payment_transactions (provider, provider_transaction_id)
    WHERE provider_transaction_id IS NOT NULL;


CREATE INDEX payment_transactions_community_id_idx
    ON payment_transactions (community_id);

CREATE INDEX payment_transactions_user_id_idx
    ON payment_transactions (user_id);

CREATE INDEX payment_transactions_contribution_id_idx
    ON payment_transactions (contribution_id);

CREATE INDEX payment_transactions_provider_idx
    ON payment_transactions (provider);

CREATE INDEX payment_transactions_status_idx
    ON payment_transactions (status);

CREATE INDEX payment_transactions_created_at_idx
    ON payment_transactions (created_at);


CREATE TRIGGER payment_transactions_set_updated_at
BEFORE UPDATE ON payment_transactions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
