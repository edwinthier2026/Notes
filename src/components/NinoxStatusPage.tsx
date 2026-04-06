import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import {
  createNinoxBackupArchive,
  createNinoxTableBackupArchive,
  testNinoxConnection,
  type NinoxBackupProgress,
  type NinoxConnectionResult,
} from '../lib/ninox';

const initialResult: NinoxConnectionResult = {
  ok: false,
  status: 0,
  message: 'Nog niet getest.',
  tables: [],
};

type BackupMode = 'full' | 'leden';

export default function NinoxStatusPage() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<NinoxConnectionResult>(initialResult);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMode, setBackupMode] = useState<BackupMode>('full');
  const [backupMessage, setBackupMessage] = useState('');
  const [backupError, setBackupError] = useState('');

  const createBackupFileName = (mode: BackupMode): string => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const mi = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    const prefix = mode === 'leden' ? 'ninox-backup-leden' : 'ninox-backup';
    return `${prefix}-${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}.zip`;
  };

  const downloadBlobFile = (fileName: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const runCheck = async () => {
    setLoading(true);
    const testResult = await testNinoxConnection();
    setResult(testResult);
    setLoading(false);
  };

  const runBackup = async (mode: BackupMode) => {
    setBackupLoading(true);
    setBackupMode(mode);
    setBackupError('');
    setBackupMessage(mode === 'leden' ? 'Testbackup Leden met bestanden wordt opgebouwd...' : 'Backup met bestanden wordt opgebouwd...');

    try {
      const onProgress = (progress: NinoxBackupProgress) => {
        if (progress.phase === 'files' && progress.fileCount && progress.fileIndex) {
          setBackupMessage(
            `Bestand ${progress.fileIndex}/${progress.fileCount} ophalen uit ${progress.tableName}: ${progress.fileName || 'bestand'}`
          );
          return;
        }
        setBackupMessage(
          `Bezig met tabel ${progress.tableIndex}/${progress.tableCount}: ${progress.tableName} (${progress.recordCount} records)`
        );
      };

      const archive =
        mode === 'leden'
          ? await createNinoxTableBackupArchive('Leden', onProgress)
          : await createNinoxBackupArchive(onProgress);

      const fileName = createBackupFileName(mode);
      downloadBlobFile(fileName, archive.blob);
      setBackupMessage(
        `Backup klaar: ${archive.dump.tableCount} tabellen, ${archive.dump.totalRecords} records en ${archive.dump.totalFiles || 0} bestanden. Bestand gedownload: ${fileName}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backup maken mislukt.';
      setBackupError(message);
      setBackupMessage('');
    } finally {
      setBackupLoading(false);
    }
  };

  useEffect(() => {
    void runCheck();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dc-gray-500">Ninox Integratie</h1>
        <p className="text-dc-gray-400 mt-1">Live statuscheck van de API-verbinding.</p>
      </div>

      <div className="bg-white rounded-xl border border-dc-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-sm text-dc-gray-400">Verbindingsstatus</div>
            <div className={`text-lg font-semibold ${result.ok ? 'text-emerald-600' : 'text-red-600'}`}>
              {result.ok ? 'Verbonden' : 'Niet verbonden'}
            </div>
          </div>

          <button
            onClick={() => void runCheck()}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Controleren...' : 'Opnieuw controleren'}
          </button>
        </div>

        <div className="mt-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => void runBackup('leden')}
              disabled={backupLoading}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {backupLoading && backupMode === 'leden' ? (
                <span className="inline-flex items-center">
                  <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />
                  Bezig...
                </span>
              ) : (
                <span className="inline-flex items-center">
                  <Download className="w-4 h-4 mr-2" />
                  Test backup Leden
                </span>
              )}
            </button>

            <button
              onClick={() => void runBackup('full')}
              disabled={backupLoading}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {backupLoading && backupMode === 'full' ? (
                <span className="inline-flex items-center">
                  <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />
                  Bezig...
                </span>
              ) : (
                <span className="inline-flex items-center">
                  <Download className="w-4 h-4 mr-2" />
                  Backup downloaden met bestanden
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 text-sm text-dc-gray-500">
          <div>
            HTTP status: <span className="font-semibold">{result.status || '-'}</span>
          </div>
          <div className="mt-1">{result.message}</div>
        </div>

        {backupMessage && (
          <div className="mt-4 text-sm text-dc-gray-500 bg-dc-gray-50 border border-dc-gray-100 rounded-lg px-3 py-2">
            {backupMessage}
          </div>
        )}

        {backupError && (
          <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            Backup mislukt: {backupError}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-dc-gray-100 p-6">
        <h2 className="text-lg font-semibold text-dc-gray-500 mb-4">Beschikbare tabellen</h2>

        {result.tables.length === 0 ? (
          <p className="text-sm text-dc-gray-400">Geen tabellen geladen.</p>
        ) : (
          <ul className="space-y-2">
            {result.tables.map((table) => (
              <li key={table.id} className="p-3 rounded-lg bg-dc-gray-50 text-sm text-dc-gray-500">
                <span className="font-medium">{table.name}</span>
                <span className="text-dc-gray-400"> ({table.recordCount ?? 0} records)</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}