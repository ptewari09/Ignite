"""Immutable identity-only contracts. Raw payloads/messages are not inputs."""

from dataclasses import dataclass
from enum import StrEnum
from math import isfinite
from typing import TypeAlias


RawIdentifier: TypeAlias = str | int | float | bool | None


class SourceRole(StrEnum):
    TRANSFORMATION = "transformation"
    UPLOAD = "post_upload"


class MatchOutcome(StrEnum):
    SHARED = "SHARED"
    TRANSFORMATION_ONLY = "TRANSFORMATION_ONLY"
    UPLOAD_ONLY = "UPLOAD_ONLY"
    NEEDS_REVIEW = "NEEDS_REVIEW"


class ReviewFlag(StrEnum):
    MISSING_OBJECT_TYPE = "MISSING_OBJECT_TYPE"
    MISSING_OBJECT_NAME = "MISSING_OBJECT_NAME"
    NORMALIZATION_MISMATCH = "NORMALIZATION_MISMATCH"
    NORMALIZATION_COLLISION = "NORMALIZATION_COLLISION"
    NON_TEXT_IDENTITY = "NON_TEXT_IDENTITY"
    NON_ASCII_IDENTITY = "NON_ASCII_IDENTITY"
    INTERNAL_WHITESPACE = "INTERNAL_WHITESPACE"
    UNKNOWN_OBJECT_TYPE = "UNKNOWN_OBJECT_TYPE"
    UNTRACEABLE_SOURCE = "UNTRACEABLE_SOURCE"
    INVALID_SOURCE_LOCATION = "INVALID_SOURCE_LOCATION"
    DIFFERENT_TYPE_SAME_NAME = "DIFFERENT_TYPE_SAME_NAME"
    UNCERTAIN_OTHER_SOURCE = "UNCERTAIN_OTHER_SOURCE"


@dataclass(frozen=True, slots=True, kw_only=True)
class ObjectRecord:
    """A caller-supplied snapshot, not an ORM object or a workbook row reader.

    Supply original scalar cell values when available, rather than concealing
    a numeric identity behind its persisted text conversion. Missing source
    identifiers/locations remain None. All supplied context must describe one
    project/cycle and one workbook per role.
    """

    object_type_raw: RawIdentifier
    object_name_raw: RawIdentifier
    object_type_normalized: str | None
    object_name_normalized: str | None
    source_record_id: str | None = None
    workbook_id: str | None = None
    worksheet_name: str | None = None
    excel_row_number: int | None = None
    project_id: str | None = None
    cycle_id: str | None = None

    def __post_init__(self) -> None:
        for value in (self.object_type_raw, self.object_name_raw):
            if value is not None and not isinstance(value, (str, int, float, bool)):
                raise TypeError("Raw identity values must be immutable scalar values or None.")
            if isinstance(value, float) and not isfinite(value):
                raise ValueError("Raw identity values must not contain non-finite numbers.")
        for value in (
            self.object_type_normalized, self.object_name_normalized,
            self.source_record_id, self.workbook_id, self.worksheet_name,
            self.project_id, self.cycle_id,
        ):
            if value is not None and not isinstance(value, str):
                raise TypeError("Identity, identifier and worksheet text fields must be strings or None.")
        if self.excel_row_number is not None and (not isinstance(self.excel_row_number, int) or isinstance(self.excel_row_number, bool)):
            raise TypeError("Excel row numbers must be integers or None.")


@dataclass(frozen=True, slots=True, kw_only=True)
class EvidenceReference(ObjectRecord):
    source_role: SourceRole


@dataclass(frozen=True, slots=True, order=True)
class TypedObjectKey:
    object_type: str
    object_name: str


@dataclass(frozen=True, slots=True)
class SourceRowCounts:
    transformation: int
    upload: int

    @property
    def total(self) -> int:
        return self.transformation + self.upload


@dataclass(frozen=True, slots=True)
class OutcomeCounts:
    shared: int
    transformation_only: int
    upload_only: int
    needs_review: int


@dataclass(frozen=True, slots=True)
class ObjectCase:
    case_id: str
    outcome: MatchOutcome
    typed_key: TypedObjectKey | None
    evidence: tuple[EvidenceReference, ...]
    source_rows: SourceRowCounts
    explanation: str
    review_flags: tuple[ReviewFlag, ...]


@dataclass(frozen=True, slots=True)
class ReconciliationSummary:
    total_cases: int
    grouped_typed_keys: int
    unkeyed_review_cases: int
    distinct_observed_typed_keys: int
    distinct_observed_names: int
    source_rows: SourceRowCounts
    review_rows: SourceRowCounts
    outcomes: OutcomeCounts


@dataclass(frozen=True, slots=True)
class ReconciliationResult:
    algorithm_version: str
    project_id: str | None
    cycle_id: str | None
    cases: tuple[ObjectCase, ...]
    summary: ReconciliationSummary
