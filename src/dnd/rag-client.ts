import { config } from '../config.js';

export interface Source {
  n: number;
  document_id: string;
  filename: string;
  page: number | null;
  score: number;
}

export interface Answer {
  answer: string;
  sources: Source[];
}

export interface DocumentInfo {
  id: string;
  filename: string;
  status: 'processing' | 'ready' | 'failed';
  chunks: number;
  pages: number | null;
  error: string | null;
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<T> {
  const headers = new Headers(init.headers);
  if (config.rag.apiKey) headers.set('X-API-Key', config.rag.apiKey);
  const response = await fetch(`${config.rag.url}${path}`, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { detail?: unknown };
    throw new Error(typeof body.detail === 'string' ? body.detail : `Knowledge service returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function ask(question: string): Promise<Answer> {
  // Local models can be slow, especially on CPU; Discord allows 15 minutes for a deferred reply.
  return request('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  }, 600_000);
}

export function uploadDocument(filename: string, data: ArrayBuffer, contentType: string): Promise<DocumentInfo> {
  const form = new FormData();
  form.append('file', new Blob([data], { type: contentType }), filename);
  return request('/documents', { method: 'POST', body: form }, 120_000);
}

export function listDocuments(): Promise<DocumentInfo[]> {
  return request('/documents');
}

export function deleteDocument(id: string): Promise<{ deleted: string }> {
  return request(`/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
