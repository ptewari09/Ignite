import { Workflow } from 'lucide-react';
import { Link } from 'react-router';

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link to="/overview" onClick={onNavigate} className="brand" aria-label="TraceSync overview">
      <span className="brand-mark"><Workflow size={25} strokeWidth={1.7} aria-hidden="true" /></span>
      <span>
        <span className="brand-name">TraceSync<span className="text-brand-accent">.</span></span>
        <span className="brand-caption">TRANSFORMATION WORKSPACE</span>
      </span>
    </Link>
  );
}
