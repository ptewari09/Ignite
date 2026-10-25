import { FileUp, Files, FolderKanban, Layers } from 'lucide-react';

export const guideSteps = [
  {
    id: 'project', title: 'Create a project', icon: FolderKanban,
    description: 'A project organizes the work for a particular customer or engagement. It gives that work a shared home for reports, review cycles and evidence.',
    noteTitle: 'Keep the customer context together',
    note: 'Use a separate project for each engagement so its reports and review decisions stay in the right context.',
  },
  {
    id: 'cycle', title: 'Create an upload cycle', icon: Layers,
    description: 'An upload cycle represents one transformation/upload review period within a project. It keeps the reports for that review together.',
    noteTitle: 'Give each review its own context',
    note: 'Use a new cycle for a later upload review. That keeps earlier source evidence separate from the next iteration.',
  },
  {
    id: 'reports', title: 'Upload source reports', icon: FileUp,
    description: 'Each review uses two sources: a transformation findings workbook and a post-upload workbook. Together they provide the evidence for the review.',
    noteTitle: 'Two reports, different roles',
    note: 'The transformation workbook contains the initial findings. The post-upload workbook contains object results and detailed upload messages.',
  },
  {
    id: 'evidence', title: 'Explore evidence', icon: Files,
    description: 'Inspect imported findings, upload objects and detailed errors, with worksheet and row references, before deciding on customer-facing actions.',
    noteTitle: 'Read the evidence before deciding',
    note: 'Tool messages and manually added comments stay distinct. Neither automatically approves a customer-facing action.',
  },
] as const;
