"""Deterministic typed-key comparison over caller-supplied immutable snapshots."""

from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import asdict, dataclass
from hashlib import sha256
import json

from app.services.normalization import normalize_identifier
from app.services.reconciliation.domain import (
    EvidenceReference, MatchOutcome, ObjectCase, ObjectRecord, OutcomeCounts,
    RawIdentifier, ReconciliationResult, ReconciliationSummary, ReviewFlag,
    SourceRole, SourceRowCounts, TypedObjectKey,
)

ALGORITHM_VERSION = "object-match-v1"
# Observed vocabulary, not an assertion of complete SAP type semantics.
KNOWN_OBJECT_TYPES = frozenset({"PROG", "FUGR", "CLAS", "FUNC", "METH", "INCL"})


@dataclass
class _Identity:
    evidence: EvidenceReference
    supplied_key: TypedObjectKey | None
    flags: set[ReviewFlag]
    name_hints: frozenset[str]
    trusted_type: str | None


@dataclass
class _UncertainCoverage:
    names: set[str]
    unnamed_types: set[str]
    any_key: bool = False

    def add(self, identity: _Identity) -> None:
        if identity.name_hints:
            self.names.update(identity.name_hints)
        elif identity.trusted_type:
            self.unnamed_types.add(identity.trusted_type)
        else:
            self.any_key = True

    def could_contain(self, key: TypedObjectKey) -> bool:
        return self.any_key or key.object_name in self.names or key.object_type in self.unnamed_types


def _present(value: str | None) -> bool:
    return value is not None and bool(value.strip())


def _token_signature(value: RawIdentifier) -> tuple[str, str]:
    """Ignore benign outer padding/ASCII case; retain lossy distinctions."""
    if isinstance(value, str):
        trimmed = value.strip()
        return ("text", trimmed.upper() if trimmed.isascii() else trimmed)
    return (type(value).__name__, repr(value))


def _json(value: object) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(",", ":"), allow_nan=False)


def _digest(value: object) -> str:
    return sha256(_json(value).encode("utf-8")).hexdigest()


def _evidence_order(ref: EvidenceReference) -> tuple[int, str, str, bool, int, str, str]:
    return (
        0 if ref.source_role == SourceRole.TRANSFORMATION else 1,
        ref.workbook_id or "", ref.worksheet_name or "",
        ref.excel_row_number is None, ref.excel_row_number or 0,
        ref.source_record_id or "", _json(asdict(ref)),
    )


def _inspect(record: ObjectRecord, role: SourceRole) -> _Identity:
    evidence = EvidenceReference(source_role=role, **asdict(record))
    raw_type = normalize_identifier(record.object_type_raw)
    raw_name = normalize_identifier(record.object_name_raw)
    supplied_type, supplied_name = record.object_type_normalized, record.object_name_normalized
    flags: set[ReviewFlag] = set()
    if not _present(supplied_type) or raw_type is None:
        flags.add(ReviewFlag.MISSING_OBJECT_TYPE)
    if not _present(supplied_name) or raw_name is None:
        flags.add(ReviewFlag.MISSING_OBJECT_NAME)
    if (supplied_type, supplied_name) != (raw_type, raw_name):
        flags.add(ReviewFlag.NORMALIZATION_MISMATCH)
    for value in (record.object_type_raw, record.object_name_raw):
        if value is None:
            continue
        if not isinstance(value, str):
            flags.add(ReviewFlag.NON_TEXT_IDENTITY)
        else:
            trimmed = value.strip()
            if not trimmed.isascii():
                flags.add(ReviewFlag.NON_ASCII_IDENTITY)
            if any(character.isspace() for character in trimmed):
                flags.add(ReviewFlag.INTERNAL_WHITESPACE)
    if _present(supplied_type) and supplied_type not in KNOWN_OBJECT_TYPES:
        flags.add(ReviewFlag.UNKNOWN_OBJECT_TYPE)
    valid_location = _present(record.worksheet_name) and record.excel_row_number is not None and record.excel_row_number >= 2
    if record.excel_row_number is not None and record.excel_row_number < 2:
        flags.add(ReviewFlag.INVALID_SOURCE_LOCATION)
    if not _present(record.source_record_id) and not valid_location:
        flags.add(ReviewFlag.UNTRACEABLE_SOURCE)
    key = TypedObjectKey(supplied_type, supplied_name) if _present(supplied_type) and _present(supplied_name) else None
    trusted_type = supplied_type if (
        isinstance(record.object_type_raw, str) and raw_type == supplied_type
        and supplied_type in KNOWN_OBJECT_TYPES
    ) else None
    return _Identity(evidence, key, flags, frozenset(n for n in (supplied_name, raw_name) if _present(n)), trusted_type)


def _validate_scope(sources: tuple[tuple[ObjectRecord, ...], ...]) -> tuple[str | None, str | None]:
    records = sources[0] + sources[1]
    context: list[str | None] = []
    for field in ("project_id", "cycle_id"):
        values = [getattr(record, field) for record in records]
        supplied = {value for value in values if value is not None}
        if len(supplied) > 1 or (supplied and any(value is None for value in values)) or any(not value.strip() for value in supplied):
            raise ValueError("Inputs must describe one consistent project/cycle; partial supplied context is not allowed.")
        context.append(next(iter(supplied)) if supplied else None)
    for source in sources:
        ids: set[str] = set()
        locations: set[tuple] = set()
        workbooks = {record.workbook_id for record in source if record.workbook_id is not None}
        if len(workbooks) > 1:
            raise ValueError("Inputs must contain one workbook per source role.")
        for record in source:
            if _present(record.source_record_id):
                if record.source_record_id in ids:
                    raise ValueError("The same source record ID was supplied more than once within a role.")
                ids.add(record.source_record_id)
            if _present(record.worksheet_name) and record.excel_row_number is not None:
                location = (record.workbook_id, record.worksheet_name, record.excel_row_number)
                if location in locations:
                    raise ValueError("The same source row location was supplied more than once within a role.")
                locations.add(location)
    return context[0], context[1]


def _counts(refs: Iterable[EvidenceReference]) -> SourceRowCounts:
    counts = Counter(ref.source_role for ref in refs)
    return SourceRowCounts(counts[SourceRole.TRANSFORMATION], counts[SourceRole.UPLOAD])


def _make_case(case_id: str, key: TypedObjectKey | None, refs: Iterable[EvidenceReference], flags: set[ReviewFlag]) -> ObjectCase:
    evidence = tuple(sorted(refs, key=_evidence_order))
    rows = _counts(evidence)
    if flags:
        outcome = MatchOutcome.NEEDS_REVIEW
        explanation = "Identity requires review: " + ", ".join(flag.value.lower().replace("_", " ") for flag in sorted(flags)) + ". No uncertain source rows were matched."
    elif rows.transformation and rows.upload:
        outcome = MatchOutcome.SHARED
        explanation = "The checked normalized object type and name occur in both source collections; every contributing row is retained."
    elif rows.transformation:
        outcome = MatchOutcome.TRANSFORMATION_ONLY
        explanation = "The checked typed key occurs only in transformation input, with no conflicting or incomplete opposite-side identity that could account for it."
    else:
        outcome = MatchOutcome.UPLOAD_ONLY
        explanation = "The checked typed key occurs only in upload-object input, with no conflicting or incomplete opposite-side identity that could account for it."
    return ObjectCase(case_id, outcome, key, evidence, rows, explanation, tuple(sorted(flags)))


def reconcile_objects(transformation: Iterable[ObjectRecord], upload_objects: Iterable[ObjectRecord]) -> ReconciliationResult:
    """Compare one source pair without I/O, mutation, fuzzy or name-only links.

    Supplied scope is validated, not inferred. Missing/unsafe rows remain
    individual review cases. They may prevent a one-sided absence claim,
    but are never attached to a reliable object by name or adjacency.
    """
    sources = (tuple(transformation), tuple(upload_objects))
    if any(not isinstance(record, ObjectRecord) or isinstance(record, EvidenceReference) for source in sources for record in source):
        raise TypeError("The matcher requires ObjectRecord snapshots, not ORM or arbitrary records.")
    project_id, cycle_id = _validate_scope(sources)
    roles = (SourceRole.TRANSFORMATION, SourceRole.UPLOAD)
    identities = [_inspect(record, role) for role, source in zip(roles, sources) for record in source]

    observed: dict[TypedObjectKey, list[_Identity]] = defaultdict(list)
    for identity in identities:
        if identity.supplied_key is not None:
            observed[identity.supplied_key].append(identity)
    for same_key in observed.values():
        signatures = {(_token_signature(i.evidence.object_type_raw), _token_signature(i.evidence.object_name_raw)) for i in same_key}
        if len(signatures) > 1:
            for identity in same_key:
                identity.flags.add(ReviewFlag.NORMALIZATION_COLLISION)

    grouped: dict[TypedObjectKey, list[EvidenceReference]] = defaultdict(list)
    unsafe: list[_Identity] = []
    uncertain = {role: _UncertainCoverage(set(), set()) for role in SourceRole}
    names = {role: set() for role in SourceRole}
    for identity in identities:
        if identity.flags:
            unsafe.append(identity)
            uncertain[identity.evidence.source_role].add(identity)
        else:
            grouped[identity.supplied_key].append(identity.evidence)
            names[identity.evidence.source_role].add(identity.supplied_key.object_name)

    cases: list[ObjectCase] = []
    for key, refs in grouped.items():
        roles = {ref.source_role for ref in refs}
        flags: set[ReviewFlag] = set()
        if len(roles) == 1:
            other = SourceRole.UPLOAD if SourceRole.TRANSFORMATION in roles else SourceRole.TRANSFORMATION
            if key.object_name in names[other]:
                flags.add(ReviewFlag.DIFFERENT_TYPE_SAME_NAME)
            if uncertain[other].could_contain(key):
                flags.add(ReviewFlag.UNCERTAIN_OTHER_SOURCE)
        cases.append(_make_case("object:" + _digest([project_id, cycle_id, key.object_type, key.object_name]), key, refs, flags))

    occurrences: Counter[str] = Counter()
    for identity in sorted(unsafe, key=lambda item: _evidence_order(item.evidence)):
        token = _digest(asdict(identity.evidence))
        occurrences[token] += 1
        cases.append(_make_case(f"review:{token}:{occurrences[token]}", None, (identity.evidence,), identity.flags))
    cases.sort(key=lambda case: (
        case.typed_key.object_type if case.typed_key else (case.evidence[0].object_type_normalized or ""),
        case.typed_key.object_name if case.typed_key else (case.evidence[0].object_name_normalized or ""),
        case.outcome.value, case.case_id,
    ))
    outcomes = Counter(case.outcome for case in cases)
    review_refs = (ref for case in cases if case.outcome == MatchOutcome.NEEDS_REVIEW for ref in case.evidence)
    summary = ReconciliationSummary(
        total_cases=len(cases), grouped_typed_keys=len(grouped), unkeyed_review_cases=len(unsafe),
        distinct_observed_typed_keys=len(observed),
        distinct_observed_names=len({identity.evidence.object_name_normalized for identity in identities if _present(identity.evidence.object_name_normalized)}),
        source_rows=SourceRowCounts(len(sources[0]), len(sources[1])), review_rows=_counts(review_refs),
        outcomes=OutcomeCounts(outcomes[MatchOutcome.SHARED], outcomes[MatchOutcome.TRANSFORMATION_ONLY], outcomes[MatchOutcome.UPLOAD_ONLY], outcomes[MatchOutcome.NEEDS_REVIEW]),
    )
    return ReconciliationResult(ALGORITHM_VERSION, project_id, cycle_id, tuple(cases), summary)
