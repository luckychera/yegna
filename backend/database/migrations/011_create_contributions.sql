-- Migration 011
-- Create member contribution obligations

CREATE TABLE contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    community_id UUID NOT NULL,
    membership_id UUID NOT NULL,

    contribution_period_start DATE NOT NULL,
    contribution_period_end DATE NOT NULL,

    due_date DATE NOT NULL,

    amount NUMERIC(18, 2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'ETB',

    status VARCHAR(32) NOT NULL DEFAULT 'pending',

    paid_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,

    waived_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,

    penalty_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT contributions_community_fk
        FOREIGN KEY (community_id)
        REFERENCES communities (id)
        ON DELETE CASCADE,

    CONSTRAINT contributions_membership_fk
        FOREIGN KEY (membership_id)
        REFERENCES community_memberships (id)
        ON DELETE CASCADE,

    CONSTRAINT contributions_period_check
        CHECK (
            contribution_period_end >= contribution_period_start
        ),

    CONSTRAINT contributions_amount_check
        CHECK (amount > 0),

    CONSTRAINT contributions_paid_amount_check
        CHECK (paid_amount >= 0),

    CONSTRAINT contributions_waived_amount_check
        CHECK (waived_amount >= 0),

    CONSTRAINT contributions_penalty_amount_check
        CHECK (penalty_amount >= 0),

    CONSTRAINT contributions_currency_check
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT contributions_status_check
        CHECK (
            status IN (
                'pending',
                'partially_paid',
                'paid',
                'overdue',
                'waived',
                'cancelled'
            )
        )
);


CREATE INDEX contributions_community_id_idx
    ON contributions (community_id);

CREATE INDEX contributions_membership_id_idx
    ON contributions (membership_id);

CREATE INDEX contributions_due_date_idx
    ON contributions (due_date);

CREATE INDEX contributions_status_idx
    ON contributions (status);

CREATE INDEX contributions_period_idx
    ON contributions (
        community_id,
        contribution_period_start,
        contribution_period_end
    );


CREATE TRIGGER contributions_set_updated_at
BEFORE UPDATE ON contributions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
