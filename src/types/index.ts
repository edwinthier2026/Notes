export type UserRole = 'Beheerder' | 'Medewerker';

export type NoteStatus = 'Concept' | 'Actief' | 'Gearchiveerd';

export interface IngelogdeGebruiker {
  id: number;
  naam: string;
  gebruikersnaam: string;
  email: string;
  functie: string;
  rol: UserRole;
  dashboard: boolean;
  relaties: boolean;
  notes: boolean;
  mailbox: boolean;
  database: boolean;
  settings: boolean;
  beheer: boolean;
}

export interface NoteItem {
  id: number;
  title: string;
  category: string;
  status: NoteStatus;
  excerpt: string;
  content: string;
  tags: string[];
  authorName: string;
  updatedAt: string;
}

export interface NoteInput {
  title: string;
  category: string;
  status: NoteStatus;
  excerpt: string;
  content: string;
  tags: string[];
}

export interface RelatieItem {
  sleutel: string;
  naamRelatie: string;
  groep: string;
  straat: string;
  postcode: string;
  woonplaats: string;
  opmerkingen: string;
}

export interface RelatieInput {
  naamRelatie: string;
  groep: string;
  straat: string;
  postcode: string;
  woonplaats: string;
  opmerkingen: string;
}

export interface DatabaseStatus {
  configured: boolean;
  connected: boolean;
  host: string;
  port: number;
  user: string;
  database: string;
  noteCount: number;
  message: string;
}

export interface MailjetStatus {
  configured: boolean;
  reachable: boolean;
  senderEmail: string;
  senderName: string;
  message: string;
}

export interface DashboardSummary {
  totalNotes: number;
  activeNotes: number;
  draftNotes: number;
  archivedNotes: number;
  recentNotes: NoteItem[];
  databaseStatus: DatabaseStatus;
  mailjetStatus: MailjetStatus;
}

export interface MailjetTestPayload {
  to: string;
  subject: string;
  text: string;
}

export interface GebruikerBeheerItem {
  sleutel: string;
  naam: string;
  gebruikersnaam: string;
  wachtwoord: string;
  email: string;
  beheerder: boolean;
  rol: 'Beheerder' | 'Medewerker';
}

export interface GebruikerBeheerInput {
  naam: string;
  gebruikersnaam: string;
  wachtwoord: string;
  email: string;
  beheerder: boolean;
}
