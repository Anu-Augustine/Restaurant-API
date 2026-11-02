"""widen order status for longer status labels

Revision ID: b7c1e4a92f10
Revises: 5338db20403f
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b7c1e4a92f10"
down_revision: Union[str, Sequence[str], None] = "5338db20403f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "orders",
        "status",
        existing_type=sa.String(length=20),
        type_=sa.String(length=40),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "orders",
        "status",
        existing_type=sa.String(length=40),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
