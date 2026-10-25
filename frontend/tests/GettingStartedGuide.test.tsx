import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GettingStartedGuide } from '../src/components/onboarding/GettingStartedGuide';

describe('Getting started educational guide', () => {
  it('starts at the project explanation with explicitly labeled guide progress', () => {
    render(<GettingStartedGuide />);
    expect(screen.getByRole('heading', { name: 'Create a project', level: 3 })).toBeInTheDocument();
    expect(screen.getByText(/particular customer or engagement/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('progressbar', { name: 'Guide progress' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '4');
    expect(within(screen.getByRole('list', { name: 'Guide steps' })).getAllByRole('button')).toHaveLength(4);
    expect(screen.getByText(/does not create projects, upload files or mark work complete/)).toBeInTheDocument();
  });

  it('advances through all four explanations and navigates back accurately', async () => {
    const user = userEvent.setup();
    render(<GettingStartedGuide />);
    for (const [title, number] of [['Create an upload cycle', '2'], ['Upload source reports', '3'], ['Explore evidence', '4']]) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByRole('heading', { name: title, level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', number);
      expect(screen.getByRole('status')).toHaveTextContent(`Guide step ${number} of 4`);
    }
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish guide' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Upload source reports', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByText(/transformation findings workbook and a post-upload workbook/)).toBeInTheDocument();
  });

  it('lets a reader select a numbered guide step without marking earlier work complete', async () => {
    const user = userEvent.setup();
    render(<GettingStartedGuide />);
    const outline = screen.getByRole('list', { name: 'Guide steps' });
    const evidenceStep = within(outline).getByRole('button', { name: 'Guide step 4: Explore evidence' });
    await user.click(evidenceStep);
    expect(evidenceStep).toHaveAttribute('aria-current', 'step');
    expect(outline.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Step 4 of 4: Explore evidence');
    expect(screen.queryByText(/project created|upload completed/i)).not.toBeInTheDocument();
  });

  it('skips and reopens from step one with useful keyboard focus restoration', async () => {
    const user = userEvent.setup();
    render(<GettingStartedGuide />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Skip guide' }));
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reopen guide' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('heading', { name: 'Create a project', level: 3 })).toHaveFocus();
  });

  it('finishes only the guide and supports restarting it', async () => {
    const user = userEvent.setup();
    render(<GettingStartedGuide />);
    await user.click(screen.getByRole('button', { name: 'Guide step 4: Explore evidence' }));
    await user.click(screen.getByRole('button', { name: 'Finish guide' }));
    expect(screen.getByText('Guide reviewed. Revisit the steps whenever you need.')).toBeInTheDocument();
    const restart = screen.getByRole('button', { name: 'Restart guide' });
    expect(restart).toHaveFocus();
    await user.click(restart);
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('supports Next and Back from a keyboard', async () => {
    const user = userEvent.setup();
    render(<GettingStartedGuide />);
    screen.getByRole('button', { name: 'Next' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'Create an upload cycle' })).toBeInTheDocument();
    screen.getByRole('button', { name: 'Back' }).focus();
    await user.keyboard(' ');
    expect(screen.getByRole('heading', { name: 'Create a project' })).toBeInTheDocument();
  });

  it('does not persist reader progress or dismissal when unmounted', async () => {
    const user = userEvent.setup();
    const first = render(<GettingStartedGuide />);
    await user.click(screen.getByRole('button', { name: 'Skip guide' }));
    first.unmount();
    render(<GettingStartedGuide />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });
});
