from typing import Any


def is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def normalize_identifier(value: Any) -> str | None:
    """Make a comparison value without removing SAP identifier punctuation."""
    return None if is_blank(value) else " ".join(str(value).split()).upper()


def normalize_header(value: str) -> str:
    return " ".join(value.split())


def raw_text(value: Any) -> str | None:
    # Preserve whitespace; non-text original types also remain in raw_payload.
    return None if value is None else str(value)
