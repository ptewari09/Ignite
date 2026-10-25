import { ArrowRight, ChevronRight, ClipboardCheck, Files, FileSpreadsheet, FileUp, FolderOpen, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { GettingStartedGuide } from '../components/onboarding/GettingStartedGuide';

const steps = [
  { label: 'Upload reports', icon: FileUp },
  { label: 'Explore evidence', icon: Files },
  { label: 'Review findings', icon: ClipboardCheck },
  { label: 'Share approved report', icon: FileSpreadsheet },
];

export function OverviewPage() {
  return (
    <div className="page-content overview-page">
      <section className="overview-introduction" aria-labelledby="overview-heading">
        <h1 id="overview-heading">Welcome to TraceSync</h1>
        <p>Organize transformation reports, inspect source evidence and prepare reviewed customer actions.</p>
      </section>

      <GettingStartedGuide />

      <section className="project-empty-card" aria-labelledby="empty-heading">
        <span className="project-empty-icon"><FolderOpen size={23} strokeWidth={1.6} aria-hidden="true" /></span>
        <div className="project-empty-copy"><h2 id="empty-heading">No project selected</h2><p>Your project’s reports, review cycles and source evidence will appear here.</p><span>Project selection is coming soon. The guide above explains how to get started.</span></div>
        <Link className="secondary-button project-preview-link" to="/projects">View projects<ArrowRight size={15} aria-hidden="true" /></Link>
      </section>

      <section className="review-workflow" aria-labelledby="workflow-heading">
        <div className="review-workflow-header"><h2 id="workflow-heading">Report review workflow</h2><span><ShieldCheck size={15} aria-hidden="true" />Guided by human review</span></div>
        <ol className="review-workflow-steps" aria-label="TraceSync workflow">
          {steps.map(({ label, icon: Icon }, index) => <li key={label}><span><Icon size={17} strokeWidth={1.7} aria-hidden="true" />{label}</span>{index < steps.length - 1 && <ChevronRight size={15} aria-hidden="true" />}</li>)}
        </ol>
      </section>
    </div>
  );
}
