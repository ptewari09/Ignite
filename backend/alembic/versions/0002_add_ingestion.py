"""Add cycle, workbook metadata and immutable source evidence tables."""

import sqlalchemy as sa
from alembic import op

revision = "0002_add_ingestion"
down_revision = "0001_create_projects"
branch_labels = None
depends_on = None


def evidence_columns():
    return [
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workbook_id", sa.Uuid(), sa.ForeignKey("workbooks.id"), nullable=False),
        sa.Column("worksheet_name", sa.String(100), nullable=False),
        sa.Column("excel_row_number", sa.Integer(), nullable=False),
        sa.Column("object_type_raw", sa.Text()),
        sa.Column("object_name_raw", sa.Text()),
        sa.Column("object_type_normalized", sa.Text()),
        sa.Column("object_name_normalized", sa.Text()),
        sa.Column("raw_payload", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    ]


def upgrade() -> None:
    op.create_table(
        "cycles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("ingestion_status", sa.String(20), nullable=False),
        sa.CheckConstraint("length(trim(name)) > 0", name="ck_cycles_name_not_blank"),
        sa.CheckConstraint("ingestion_status IN ('empty', 'partial', 'complete')", name="ck_cycles_status"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cycles_project_id", "cycles", ["project_id"])
    op.create_table(
        "workbooks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("cycle_id", sa.Uuid(), sa.ForeignKey("cycles.id"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False),
        sa.Column("ingestion_status", sa.String(20), nullable=False),
        sa.Column("sheets_found", sa.JSON(), nullable=False),
        sa.Column("row_counts", sa.JSON(), nullable=False),
        sa.Column("object_counts", sa.JSON(), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.CheckConstraint("role IN ('transformation', 'post_upload')", name="ck_workbooks_role"),
        sa.CheckConstraint("ingestion_status = 'ingested'", name="ck_workbooks_status"),
        sa.UniqueConstraint("cycle_id", "role", name="uq_workbooks_cycle_role"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workbooks_cycle_id", "workbooks", ["cycle_id"])
    for table, prefix, fields in [
        ("transformation_findings", "transformation", ["status_raw", "error_category_raw", "error_message_raw", "suggested_action_raw", "file_name_raw"]),
        ("upload_objects", "upload_object", ["status_info_raw", "tool_status_raw", "re_upload_raw", "manual_status_raw", "manual_comments_raw"]),
        ("upload_errors", "upload_error", ["info_raw", "message_type_raw", "message_raw"]),
    ]:
        columns = evidence_columns() + [sa.Column(name, sa.Text()) for name in fields]
        if table == "upload_errors":
            columns.append(sa.Column("sequence_number", sa.Integer()))
        op.create_table(
            table, *columns,
            sa.UniqueConstraint("workbook_id", "worksheet_name", "excel_row_number", name=f"uq_{prefix}_source_row"),
            sa.CheckConstraint("excel_row_number >= 2", name=f"ck_{prefix}_source_row"),
        )
        op.create_index(f"ix_{table}_workbook_id", table, ["workbook_id"])


def downgrade() -> None:
    for table in ("upload_errors", "upload_objects", "transformation_findings", "workbooks", "cycles"):
        op.drop_table(table)
