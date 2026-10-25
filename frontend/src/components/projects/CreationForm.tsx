import { useEffect, useId, useRef, useState } from 'react';
import type { SubmitEvent } from 'react';
import { Plus } from 'lucide-react';
import type { ApiError } from '../../services/apiClient';
import { workspaceError } from '../../services/workspaceApi';
import { RequestError } from './RequestFeedback';

interface Props {
  kind: 'project' | 'cycle';
  onCreate: (name: string, description: string | null) => Promise<void>;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
}

export function CreationForm({ kind, onCreate, onCancel, onBusyChange }: Props) {
  const id = useId();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [validation, setValidation] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    if (!name.trim()) { setValidation(`Enter a ${kind} name with at least one non-space character.`); return; }
    setValidation('');
    setError(null);
    pending.current = true;
    setBusy(true);
    onBusyChange(true);
    try { await onCreate(name.trim(), description.trim() || null); }
    catch (failure) { setError(workspaceError(failure)); }
    finally { pending.current = false; setBusy(false); onBusyChange(false); }
  }

  return <form className="creation-form" aria-label={`Create ${kind}`} onSubmit={submit} aria-busy={busy}>
    <h3>New {kind === 'project' ? 'project' : 'upload cycle'}</h3>
    <fieldset disabled={busy}>
      <label htmlFor={`${id}-name`}>{kind === 'project' ? 'Project' : 'Cycle'} name <span className="field-required">(required)</span></label>
      <input ref={nameRef} id={`${id}-name`} name="name" type="text" required maxLength={200} autoComplete="off"
        value={name} onChange={(event) => { setName(event.target.value); setValidation(''); }}
        aria-invalid={!!validation} aria-describedby={`${id}-hint${validation ? ` ${id}-validation` : ''}`} />
      <p className="field-hint" id={`${id}-hint`}>Use a clear label. Maximum 200 characters.</p>
      {validation && <p className="field-error" id={`${id}-validation`} role="alert">{validation}</p>}
      {kind === 'project' && <>
        <label htmlFor={`${id}-description`}>Description <span className="field-required">(optional)</span></label>
        <textarea id={`${id}-description`} name="description" rows={3} maxLength={4000} value={description}
          onChange={(event) => setDescription(event.target.value)} aria-describedby={`${id}-description-hint`} />
        <p className="field-hint" id={`${id}-description-hint`}>Briefly describe this engagement. Maximum 4,000 characters.</p>
      </>}
      <div className="creation-actions">
        <button className="primary-button" type="submit" disabled={busy}><Plus size={15} aria-hidden="true" />{busy ? `Creating ${kind}…` : `Create ${kind}`}</button>
        <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </fieldset>
    {busy && <p className="field-hint" role="status">Saving to TraceSync. Please wait.</p>}
    {error && <><RequestError error={error} title={`Could not create ${kind}`} />
      {error.status === null && <p className="field-hint">If the response was interrupted, refresh the list before trying again to check whether it was created.</p>}</>}
  </form>;
}
