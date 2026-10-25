import { PanelTop } from 'lucide-react';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="page-content">
      <section className="page-introduction compact-introduction"><div className="page-eyebrow"><span className="eyebrow-line" />YOUR WORKSPACE</div><h1>{title}</h1></section>
      <section className="empty-state placeholder-state" aria-labelledby="placeholder-heading">
        <div className="empty-icon"><PanelTop size={30} strokeWidth={1.4} aria-hidden="true" /></div>
        <span className="availability-note">Coming soon</span>
        <h2 id="placeholder-heading">This screen is not available yet</h2>
        <p>The {title.toLowerCase()} screen has not been implemented yet.</p>
      </section>
    </div>
  );
}
