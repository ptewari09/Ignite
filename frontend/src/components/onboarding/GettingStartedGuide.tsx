import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Lightbulb, RotateCcw } from 'lucide-react';
import { guideSteps } from './guideSteps';

/** A standalone educational guide. It never reads or changes project state. */
export function GettingStartedGuide() {
  const [stepIndex, setStepIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [guideReviewed, setGuideReviewed] = useState(false);
  const headingId = useId();
  const stepId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reopenRef = useRef<HTMLButtonElement>(null);
  const focusOnToggle = useRef(false);
  const step = guideSteps[stepIndex];
  const StepIcon = step.icon;
  const lastStep = stepIndex === guideSteps.length - 1;

  useEffect(() => {
    // Do not steal focus on first render. Restore it when a control is removed.
    if (!focusOnToggle.current) return;
    if (isOpen) headingRef.current?.focus();
    else reopenRef.current?.focus();
  }, [isOpen]);

  function dismissGuide(reviewed: boolean) {
    focusOnToggle.current = true;
    setGuideReviewed(reviewed);
    setIsOpen(false);
  }

  function reopenGuide() {
    focusOnToggle.current = true;
    setStepIndex(0);
    setIsOpen(true);
  }

  return (
    <section className={`onboarding-card${isOpen ? '' : ' onboarding-collapsed'}`} aria-labelledby={headingId}>
      <header className="guide-header">
        <div className="guide-heading-group">
          <span className="guide-heading-icon"><BookOpen size={20} strokeWidth={1.7} aria-hidden="true" /></span>
          <div><h2 id={headingId}>Getting started</h2><p>{isOpen ? 'A quick guide to your first review.' : guideReviewed ? 'Guide reviewed. Revisit the steps whenever you need.' : 'Learn how to organize your first review.'}</p></div>
        </div>
        {isOpen ? (
          <button className="guide-skip" type="button" onClick={() => dismissGuide(false)}>Skip guide</button>
        ) : (
          <button ref={reopenRef} className="secondary-button guide-reopen" type="button" onClick={reopenGuide}>
            <RotateCcw size={15} aria-hidden="true" />{guideReviewed ? 'Restart guide' : 'Reopen guide'}
          </button>
        )}
      </header>

      {isOpen && <>
        <div className="guide-body">
          <ol className="guide-outline" aria-label="Guide steps">
            {guideSteps.map((item, index) => (
              <li key={item.id}>
                <button className={`guide-step-button${index === stepIndex ? ' guide-step-active' : ''}`} type="button"
                  aria-label={`Guide step ${index + 1}: ${item.title}`} aria-current={index === stepIndex ? 'step' : undefined}
                  aria-controls={stepId} onClick={() => setStepIndex(index)}>
                  <span className="guide-step-number" aria-hidden="true">{index + 1}</span>
                  <span className="guide-step-label">{item.title}</span>
                </button>
              </li>
            ))}
          </ol>
          <div id={stepId} className="guide-detail" role="region" aria-labelledby={`${stepId}-heading`}>
            <p className="guide-step-caption" role="status" aria-live="polite" aria-atomic="true">Guide step {stepIndex + 1} of {guideSteps.length}<span className="sr-only">: {step.title}</span></p>
            <h3 ref={headingRef} id={`${stepId}-heading`} tabIndex={-1}><StepIcon size={22} strokeWidth={1.7} aria-hidden="true" />{step.title}</h3>
            <p className="guide-description">{step.description}</p>
            <div className="guide-note"><Lightbulb size={17} aria-hidden="true" /><div><h4>{step.noteTitle}</h4><p>{step.note}</p></div></div>
          </div>
        </div>
        <footer className="guide-footer">
          <div className="guide-progress-area">
            <div className="guide-progress-label"><span>Guide progress</span><span>{stepIndex + 1} of {guideSteps.length}</span></div>
            <div className="guide-progress-track" role="progressbar" aria-label="Guide progress" aria-valuemin={1} aria-valuemax={guideSteps.length}
              aria-valuenow={stepIndex + 1} aria-valuetext={`Step ${stepIndex + 1} of ${guideSteps.length}: ${step.title}`}>
              <span style={{ width: `${((stepIndex + 1) / guideSteps.length) * 100}%` }} />
            </div>
          </div>
          <div className="guide-controls">
            <button className="secondary-button" type="button" disabled={stepIndex === 0} onClick={() => setStepIndex((index) => index - 1)}><ArrowLeft size={15} aria-hidden="true" />Back</button>
            <button className="primary-button" type="button" onClick={() => lastStep ? dismissGuide(true) : setStepIndex((index) => index + 1)}>
              {lastStep ? 'Finish guide' : 'Next'}{!lastStep && <ArrowRight size={15} aria-hidden="true" />}
            </button>
          </div>
        </footer>
        <p className="guide-disclaimer">This walkthrough explains the steps. It does not create projects, upload files or mark work complete.</p>
      </>}
    </section>
  );
}
