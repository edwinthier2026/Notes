import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BookOpenText, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getDefaultRoute } from '../lib/routing';

export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [gebruikersnaam, setGebruikersnaam] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to={getDefaultRoute(user)} replace />;
  }

  const redirectTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(gebruikersnaam, wachtwoord);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inloggen mislukt.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dc-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-dc-gray-100 shadow-sm overflow-hidden">
        <div className="bg-[#002060] px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center">
              <BookOpenText className="h-7 w-7 text-[#11d8d4]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Notes</h1>
              <p className="text-sm text-blue-100/80">Nieuwe projectbasis met Mailjet en MariaDB</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-sm text-dc-gray-400">
            Inloggen controleert nu de ingevoerde gebruikersnaam en het wachtwoord via de MariaDB tabel `gebruikers`.
          </div>

          <div>
            <label htmlFor="gebruikersnaam" className="block text-sm font-medium text-dc-gray-500 mb-1">
              Gebruikersnaam
            </label>
            <input
              id="gebruikersnaam"
              value={gebruikersnaam}
              onChange={(event) => setGebruikersnaam(event.target.value)}
              className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-[#002060]"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div>
            <label htmlFor="wachtwoord" className="block text-sm font-medium text-dc-gray-500 mb-1">
              Wachtwoord
            </label>
            <input
              id="wachtwoord"
              type="password"
              value={wachtwoord}
              onChange={(event) => setWachtwoord(event.target.value)}
              className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-[#002060]"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#002060] text-white py-2.5 text-sm font-medium hover:bg-[#00184a] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
            {loading ? 'Inloggen...' : 'Inloggen'}
          </button>

          <div className="text-xs text-dc-gray-400 text-center">Versie {__APP_VERSION__}</div>
        </form>
      </div>
    </div>
  );
}
