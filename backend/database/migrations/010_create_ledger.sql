-- Migration 010
-- Create double-entry financial ledger

CREATE TABLE ledger_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    community_id UUID NOT NULL,

    reference_type VARCHAR(50),
    reference_id UUID,

    transaction_type VARCHAR(50) NOT NULL,

    description TEXT,

    currency CHAR(3) NOT NULL DEFAULT 'ETB',

    status VARCHAR(32) NOT NULL DEFAULT 'posted',

    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_by UUID,

    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ledger_transactions_community_fk
        FOREIGN KEY (community_id)
        REFERENCES communities (id)
        ON DELETE CASCADE,

    CONSTRAINT ledger_transactions_created_by_fk
        FOREIGN KEY (created_by)
        REFERENCES users (id)
        ON DELETE SET NULL,

    CONSTRAINT ledger_transactions_type_check
        CHECK (
            transaction_type IN (
                'contribution',
                'payment',
                'refund',
                'penalty',
                'expense',
                'income',
                'transfer',
                'adjustment',
                'withdrawal',
                'deposit',
                'other'
            )
        ),

    CONSTRAINT ledger_transactions_status_check
        CHECK (
            status IN (
                'draft',
                'posted',
                'voided'
            )
        ),

    CONSTRAINT ledger_transactions_currency_check
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT ledger_transactions_metadata_object_check
        CHECK (jsonb_typeof(metadata) = 'object')
);


CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    transaction_id UUID NOT NULL,
    account_id UUID NOT NULL,

    entry_type VARCHAR(10) NOT NULL,

    amount NUMERIC(18, 2) NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ledger_entries_transaction_fk
        FOREIGN KEY (transaction_id)
        REFERENCES ledger_transactions (id)
        ON DELETE CASCADE,

    CONSTRAINT ledger_entries_account_fk
        FOREIGN KEY (account_id)
        REFERENCES financial_accounts (id)
        ON DELETE RESTRICT,

    CONSTRAINT ledger_entries_type_check
        CHECK (
            entry_type IN (
                'debit',
                'credit'
            )
        ),

    CONSTRAINT ledger_entries_amount_check
        CHECK (amount > 0)
);


CREATE INDEX ledger_transactions_community_id_idx
    ON ledger_transactions (community_id);

CREATE INDEX ledger_transactions_reference_idx
    ON ledger_transactions (reference_type, reference_id);

CREATE INDEX ledger_transactions_type_idx
    ON ledger_transactions (transaction_type);

CREATE INDEX ledger_transactions_date_idx
    ON ledger_transactions (transaction_date);

CREATE INDEX ledger_transactions_status_idx
    ON ledger_transactions (status);

CREATE INDEX ledger_entries_transaction_id_idx
    ON ledger_entries (transaction_id);

CREATE INDEX ledger_entries_account_id_idx
    ON ledger_entries (account_id);
