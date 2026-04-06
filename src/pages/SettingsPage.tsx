import { CheckCircle2, DatabaseZap, KeyRound, Mail, Settings } from 'lucide-react';

const groups = [
  {
    title: 'Mailjet',
    icon: Mail,
    variables: ['MAILJET_API_KEY', 'MAILJET_API_SECRET', 'MAILJET_FROM_EMAIL', 'MAILJET_FROM_NAME'],
  },
  {
    title: 'MariaDB',
    icon: DatabaseZap,
    variables: ['MARIADB_HOST', 'MARIADB_PORT', 'MARIADB_USER', 'MARIADB_PASSWORD', 'MARIADB_DATABASE'],
  },
  {
    title: 'Demo login',
    icon: KeyRound,
    variables: ['NOTES_ADMIN_USERNAME', 'NOTES_ADMIN_PASSWORD', 'NOTES_USER_USERNAME', 'NOTES_USER_PASSWORD'],
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Settings size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Instellingen</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {groups.map((group) => (
          <div key={group.title} className="bg-white rounded-xl border border-dc-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <group.icon size={20} className="text-dc-blue-500" />
              <h2 className="text-lg font-semibold text-dc-gray-500">{group.title}</h2>
            </div>
            <div className="space-y-2">
              {group.variables.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-dc-gray-500">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <code>{item}</code>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-dc-gray-100 p-5">
        <h2 className="text-lg font-semibold text-dc-gray-500 mb-3">Aannames voor deze eerste basis</h2>
        <div className="space-y-2 text-sm text-dc-gray-500">
          <div>Frontend gebruikt dezelfde kaart-, sidebar- en gridopzet als het bronproject.</div>
          <div>Wanneer MariaDB nog niet beschikbaar is, draait de app op demo-notities zodat de layout meteen bruikbaar blijft.</div>
          <div>Mailverzending loopt niet meer via Azure SMTP maar rechtstreeks via de Mailjet API.</div>
          <div>Ninox-specifieke keep-alives, proxy's en tabellen zijn bewust buiten deze Notes-basis gehouden.</div>
        </div>
      </div>
    </div>
  );
}
