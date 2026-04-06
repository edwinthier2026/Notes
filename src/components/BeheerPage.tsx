import { FileText, Settings, Shield, User } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import InstellingenPage from './InstellingenPage';
import GebruikersPage from './GebruikersPage';
import StandaardDocumentenPage from './StandaardDocumentenPage';

export default function BeheerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const activeTab =
    tab === 'instellingen' || tab === 'gebruikers' || tab === 'standaard-documenten' ? tab : 'gebruikers';

  const openTab = (nextTab: 'instellingen' | 'gebruikers' | 'standaard-documenten') => {
    setSearchParams({ tab: nextTab });
  };

  const tabButtonClass = (tabName: 'instellingen' | 'gebruikers' | 'standaard-documenten') =>
    `w-full text-left rounded-lg border px-4 py-3 transition-colors ${
      activeTab === tabName
        ? 'border-dc-blue-500 bg-dc-blue-50'
        : 'border-dc-gray-100 hover:border-dc-blue-200 hover:bg-dc-blue-50/40'
    }`;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Beheer</h1>
        </div>
        <p className="text-sm text-dc-gray-400">Kies een onderdeel om te openen.</p>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-dc-gray-100 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button type="button" onClick={() => openTab('gebruikers')} className={tabButtonClass('gebruikers')}>
              <div className="flex items-center gap-2">
                <User size={18} className="text-dc-blue-500" />
                <span className="text-sm font-semibold text-dc-gray-500">Gebruikers</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => openTab('standaard-documenten')}
              className={tabButtonClass('standaard-documenten')}
            >
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-dc-blue-500" />
                <span className="text-sm font-semibold text-dc-gray-500">Standaard Documenten</span>
              </div>
            </button>

            <button type="button" onClick={() => openTab('instellingen')} className={tabButtonClass('instellingen')}>
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-dc-blue-500" />
                <span className="text-sm font-semibold text-dc-gray-500">Instellingen</span>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-dc-gray-100 p-5">
          {activeTab === 'gebruikers' && <GebruikersPage />}
          {activeTab === 'standaard-documenten' && <StandaardDocumentenPage />}
          {activeTab === 'instellingen' && <InstellingenPage />}
        </div>
      </div>
    </div>
  );
}
