import type {
  DashboardSummary,
  DatabaseStatus,
  GebruikerBeheerInput,
  GebruikerBeheerItem,
  IngelogdeGebruiker,
  MailjetStatus,
  MailjetTestPayload,
  NoteInput,
  NoteItem,
  RelatieInput,
  RelatieItem,
} from '../types';

interface LoginResponse {
  user: IngelogdeGebruiker;
}

interface NotesResponse {
  notes: NoteItem[];
}

interface NoteResponse {
  note: NoteItem;
}

interface MessageResponse {
  message: string;
}

interface UsersResponse {
  users: GebruikerBeheerItem[];
}

interface RelatiesResponse {
  relaties: RelatieItem[];
}

interface RelatieResponse {
  relatie: RelatieItem;
}

function readErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const record = payload as Record<string, unknown>;
  const direct = [record.message, record.error, record.title];
  for (const value of direct) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

export async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return fetch(`/api${normalizedPath}`, init);
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchApi(path, init);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readErrorMessage(payload) || 'API-aanroep mislukt.');
  }

  return payload as T;
}

export async function loginRequest(gebruikersnaam: string, wachtwoord: string): Promise<IngelogdeGebruiker> {
  const payload = await requestJson<LoginResponse>('/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ gebruikersnaam, wachtwoord }),
  });

  return payload.user;
}

export function fetchDashboardSummary(): Promise<DashboardSummary> {
  return requestJson<DashboardSummary>('/dashboard');
}

export async function fetchNotes(): Promise<NoteItem[]> {
  const payload = await requestJson<NotesResponse>('/notes');
  return payload.notes;
}

export async function fetchRelaties(): Promise<RelatieItem[]> {
  const payload = await requestJson<RelatiesResponse>('/relaties');
  return payload.relaties;
}

export async function createRelatie(input: RelatieInput): Promise<RelatieItem> {
  const payload = await requestJson<RelatieResponse>('/relaties', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return payload.relatie;
}

export async function createNote(input: NoteInput): Promise<NoteItem> {
  const payload = await requestJson<NoteResponse>('/notes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return payload.note;
}

export async function updateNote(noteId: number, input: NoteInput): Promise<NoteItem> {
  const payload = await requestJson<NoteResponse>(`/notes/${noteId}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return payload.note;
}

export async function deleteNote(noteId: number): Promise<void> {
  await requestJson<MessageResponse>(`/notes/${noteId}`, {
    method: 'DELETE',
  });
}

export function fetchDatabaseStatus(): Promise<DatabaseStatus> {
  return requestJson<DatabaseStatus>('/database/status');
}

export function fetchMailjetStatus(): Promise<MailjetStatus> {
  return requestJson<MailjetStatus>('/mailjet/status');
}

export function sendMailjetTest(payload: MailjetTestPayload): Promise<MessageResponse> {
  return requestJson<MessageResponse>('/mailjet/send-test', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminUsers(): Promise<GebruikerBeheerItem[]> {
  const payload = await requestJson<UsersResponse>('/admin/users');
  return payload.users;
}

export async function createAdminUser(input: GebruikerBeheerInput): Promise<GebruikerBeheerItem> {
  const payload = await requestJson<{ user: GebruikerBeheerItem }>('/admin/users', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return payload.user;
}

export async function updateAdminUser(originalGebruikersnaam: string, input: GebruikerBeheerInput): Promise<GebruikerBeheerItem> {
  const payload = await requestJson<{ user: GebruikerBeheerItem }>(`/admin/users/${encodeURIComponent(originalGebruikersnaam)}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return payload.user;
}

export async function deleteAdminUser(originalGebruikersnaam: string): Promise<void> {
  await requestJson<MessageResponse>(`/admin/users/${encodeURIComponent(originalGebruikersnaam)}`, {
    method: 'DELETE',
  });
}
