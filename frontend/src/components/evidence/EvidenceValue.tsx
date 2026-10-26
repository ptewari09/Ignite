export function EvidenceValue({ value, quoted = false }: { value: unknown; quoted?: boolean }) {
  if (value === null || value === undefined) return <span className="evidence-missing" aria-label="Not provided">—</span>;
  const text = typeof value === 'string' && !quoted && value.trim() ? value
    : typeof value === 'string' || typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  return <span className="evidence-value">{text}</span>;
}
