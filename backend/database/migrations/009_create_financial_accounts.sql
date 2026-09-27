-- Migration 009
-- Create financial accounts for communities

CREATE TABLE financial_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    community_id UUID NOT NULL,

    account_name VARCHAR(150) NOT NULL,
    account_type VARCHAR(32) NOT NULL,

    currency CHAR(3) NOT NULL DEFAULT 'ETB',

    status VARCHAR(32) NOT NULL DEFAULT 'active',

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,

    CONSTRAINT financial_accounts_community_fk
        FOREIGN KEY (community_id)
        REFERENCES communities (id)
        ON DELETE CASCADE,

    CONSTRAINT financial_accounts_type_check
        CHECK (
            account_type IN (
                'cash',
                'bank',
                'mobile_money',
                'wallet',
                'receivable',
                'payable',
                'income',
                'expense',
                'reserve',
                'other'
            )
        ),

    CONSTRAINT financial_accounts_status_check
        CHECK (
            status IN (
                'active',
                'suspended',
                'closed'
            )
        ),

    CONSTRAINT financial_accounts_currency_check
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT financial_accounts_unique_name
        UNIQUE (community_id, account_name)
);

CREATE INDEX financial_accounts_community_id_idx
    ON financial_accounts (community_id);

CREATE INDEX financial_accounts_type_idx
    ON financial_accounts (account_type);

CREATE INDEX financial_accounts_status_idx
    ON financial_accounts (status);

CREATE TRIGGER financial_accounts_set_updated_at
BEFORE UPDATE ON financial_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
