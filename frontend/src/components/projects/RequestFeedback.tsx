import { AlertCircle, LoaderCircle } from 'lucide-react';
import type { ApiError } from '../../services/apiClient';

export function LoadingState({ children }: { children: string }) {
  return <p className="request-loading" role="status"><LoaderCircle size={16} aria-hidden="true" />{children}</p>;
}

export function RequestError({ error, title, onRetry }: { error: ApiError; title: string; onRetry?: () => void }) {
  return <div className="request-error" role="alert">
    <AlertCircle size={18} aria-hidden="true" />
    <div><p className="font-semibold">{title}</p><p>{error.message}</p>
      {error.requestId && <p className="request-reference">Reference: {error.requestId}</p>}
      {onRetry && <button className="secondary-button mt-3" type="button" onClick={onRetry}>Try again</button>}
    </div>
  </div>;
}
