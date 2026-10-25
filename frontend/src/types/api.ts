export interface ApiErrorEnvelope {
  error: { code: string; message: string };
  request_id: string;
}
