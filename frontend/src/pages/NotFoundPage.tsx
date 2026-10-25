import { Compass } from 'lucide-react';
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="empty-state placeholder-state">
      <div className="empty-icon"><Compass size={30} aria-hidden="true" /></div>
      <h1>Page not found</h1>
      <p>This address does not lead to a TraceSync screen.</p>
      <Link className="primary-link" to="/overview">Back to overview</Link>
    </section>
  );
}
