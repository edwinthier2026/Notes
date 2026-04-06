import { ClipboardList, Shield, Users } from 'lucide-react';
import { useState } from 'react';
import GebruikersBeheerTab from './beheertabs/GebruikersBeheerTab';

const todoItems = [
  'Koppel echte gebruikers/authenticatie aan MariaDB of een aparte identity provider.',
  'Breid het notitiemodel uit met relaties, bijlagen en rechten per map of team.',
  'Voeg Mailjet templates, webhooks en verzendlogging toe wanneer de functionele scope vastligt.',
  'Maak van de demo CRUD-schermen echte modules zodra de databasedefinities definitief zijn.',
];

export default function BeheerPage() {
  const [activeTab, setActiveTab] = useState<'gebruikers' | 'roadmap'>('gebruikers');

  const tabButtonClass = (tabName: 'gebruikers' | 'roadmap') =>
    `w-full text-left rounded-lg border px-4 py-3 transition-colors ${
      activeTab === tabName
        ? 'border-dc-blue-500 bg-dc-blue-50'
        : 'border-dc-gray-100 hover:border-dc-blue-200 hover:bg-dc-blue-50/40'
    }`;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Shield size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Beheer</h1>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-dc-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button type="button" onClick={() => setActiveTab('gebruikers')} className={tabButtonClass('gebruikers')}>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-dc-blue-500" />
              <span className="text-sm font-semibold text-dc-gray-500">Gebruikers</span>
            </div>
          </button>
          <button type="button" onClick={() => setActiveTab('roadmap')} className={tabButtonClass('roadmap')}>
            <div className="flex items-center gap-2">
              <ClipboardList size={18} className="text-dc-blue-500" />
              <span className="text-sm font-semibold text-dc-gray-500">Roadmap</span>
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'gebruikers' && <GebruikersBeheerTab />}

      {activeTab === 'roadmap' && (
        <div className="bg-white rounded-xl border border-dc-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList size={20} className="text-dc-blue-500" />
            <h2 className="text-lg font-semibold text-dc-gray-500">Aanbevolen vervolgstappen</h2>
          </div>
          <div className="space-y-3">
            {todoItems.map((item) => (
              <div key={item} className="rounded-lg bg-dc-gray-50 border border-dc-gray-100 px-4 py-3 text-sm text-dc-gray-500">
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
