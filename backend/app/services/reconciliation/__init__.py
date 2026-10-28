"""Pure object comparison; no database, HTTP or workbook operations."""

from app.services.reconciliation.domain import (
    EvidenceReference,
    MatchOutcome,
    ObjectCase,
    ObjectRecord,
    OutcomeCounts,
    ReconciliationResult,
    ReconciliationSummary,
    ReviewFlag,
    SourceRole,
    SourceRowCounts,
    TypedObjectKey,
)
from app.services.reconciliation.object_matching import reconcile_objects

__all__ = [
    "EvidenceReference", "MatchOutcome", "ObjectCase", "ObjectRecord",
    "OutcomeCounts", "ReconciliationResult", "ReconciliationSummary",
    "ReviewFlag", "SourceRole", "SourceRowCounts", "TypedObjectKey",
    "reconcile_objects",
]
