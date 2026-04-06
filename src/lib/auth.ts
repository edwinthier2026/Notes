import type { IngelogdeGebruiker } from '../types';
import { loginRequest } from './api';

export async function loginViaApi(gebruikersnaamInput: string, wachtwoordInput: string): Promise<IngelogdeGebruiker> {
  const gebruikersnaam = gebruikersnaamInput.trim();
  const wachtwoord = wachtwoordInput.trim();

  if (!gebruikersnaam || !wachtwoord) {
    throw new Error('Vul gebruikersnaam en wachtwoord in.');
  }

  return loginRequest(gebruikersnaam, wachtwoord);
}

export async function refreshAuthenticatedUser(user: IngelogdeGebruiker): Promise<IngelogdeGebruiker> {
  return user;
}
