import { Building2, Users } from 'lucide-react';
import { useState } from 'react';
import RelatiesTab from './relatietabs/RelatiesTab';

type RelatiesTab = 'relaties';

export default function RelatiesPage() {
  const [activeTab, setActiveTab] = useState<RelatiesTab>('relaties');

  const tabButtonClass = (tabName: RelatiesTab) =>
    `w-full text-left rounded-lg border px-4 py-3 transition-colors ${
      activeTab === tabName
        ? 'border-dc-blue-500 bg-dc-blue-50'
        : 'border-dc-gray-100 hover:border-dc-blue-200 hover:bg-dc-blue-50/40'
    }`;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Users size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Relaties</h1>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-dc-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <button type="button" onClick={() => setActiveTab('relaties')} className={tabButtonClass('relaties')}>
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-dc-blue-500" />
              <span className="text-sm font-semibold text-dc-gray-500">Relaties</span>
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'relaties' && <RelatiesTab />}
    </div>
  );
}
