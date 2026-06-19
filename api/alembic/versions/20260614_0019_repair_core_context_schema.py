"""Repair core-card and context-cache columns when local dev schema drifted.

Revision ID: 20260614_0019
Revises: 20260614_0018
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260614_0019"
down_revision: str | None = "20260614_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE cardsets
        ADD COLUMN IF NOT EXISTS core BOOLEAN NOT NULL DEFAULT FALSE
        """
    )
    op.execute("ALTER TABLE cardsets ALTER COLUMN core DROP DEFAULT")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cardsets_core ON cardsets (core)")

    op.execute(
        """
        ALTER TABLE card_role_evaluations
        ADD COLUMN IF NOT EXISTS context_key VARCHAR(64) NOT NULL DEFAULT ''
        """
    )
    op.execute(
        """
        UPDATE card_role_evaluations
        SET context_key = md5(
            deck_id::text
            || ':' || deck_revision::text
            || ':' || oracle_id
            || ':' || evaluator_version
        )
        WHERE context_key = ''
        """
    )
    op.execute("ALTER TABLE card_role_evaluations ALTER COLUMN context_key DROP DEFAULT")
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_card_role_evaluations_context_key
        ON card_role_evaluations (context_key)
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'uq_card_role_evaluation_revision_oracle_version'
            ) THEN
                ALTER TABLE card_role_evaluations
                DROP CONSTRAINT uq_card_role_evaluation_revision_oracle_version;
            END IF;
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'uq_card_role_evaluation_context_version'
            ) THEN
                ALTER TABLE card_role_evaluations
                ADD CONSTRAINT uq_card_role_evaluation_context_version
                UNIQUE (deck_id, context_key, evaluator_version);
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'uq_card_role_evaluation_context_version'
            ) THEN
                ALTER TABLE card_role_evaluations
                DROP CONSTRAINT uq_card_role_evaluation_context_version;
            END IF;
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'uq_card_role_evaluation_revision_oracle_version'
            ) THEN
                ALTER TABLE card_role_evaluations
                ADD CONSTRAINT uq_card_role_evaluation_revision_oracle_version
                UNIQUE (deck_id, deck_revision, oracle_id, evaluator_version);
            END IF;
        END
        $$;
        """
    )
    op.execute("DROP INDEX IF EXISTS ix_card_role_evaluations_context_key")
    op.drop_column("card_role_evaluations", "context_key")

    op.execute("DROP INDEX IF EXISTS ix_cardsets_core")
    op.drop_column("cardsets", "core")
