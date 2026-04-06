import { FileText, Loader2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { StandaardDocument } from '../types';
import {
  clearNinoxStandaardDocumentBestand,
  createNinoxStandaardDocument,
  deleteNinoxStandaardDocument,
  fetchNinoxStandaardDocumentBestand,
  fetchNinoxStandaardDocumenten,
  updateNinoxStandaardDocument,
  uploadNinoxStandaardDocumentBestand,
} from '../lib/ninox';
import { waitForNextPaint } from '../lib/render';
import { compareStrings, nextSortState, type SortState } from '../lib/sort';
import { matchesAllTerms, parseSearchTerms } from '../lib/search';
import ConfirmDialog from './ui/ConfirmDialog';
import LoadingSpinner from './ui/LoadingSpinner';
import SortableTh from './ui/SortableTh';

type ModalMode = 'nieuw' | 'bewerk';

function titelUitBestandsnaam(bestandsnaam: string): string {
  return String(bestandsnaam || '')
    .replace(/\.pdf$/i, '')
    .trim();
}

export default function StandaardDocumentenPage() {
  const [items, setItems] = useState<StandaardDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoek, setZoek] = useState('');
  const [sort, setSort] = useState<SortState<'titel'>>({ key: 'titel', direction: 'asc' });
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openingRowId, setOpeningRowId] = useState<number | null>(null);
  const [titel, setTitel] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [documentNaam, setDocumentNaam] = useState('');
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState('');
  const [documentDragActive, setDocumentDragActive] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [itemVoorVervallen, setItemVoorVervallen] = useState<StandaardDocument | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const documentPreviewUrlRef = useRef('');
  const documentInlinePreviewUrl = documentPreviewUrl
    ? `${documentPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&messages=0`
    : '';

  const loadItems = async () => {
    try {
      const data = await fetchNinoxStandaardDocumenten();
      setItems(data);
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout';
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const clearPreviewUrl = () => {
    if (documentPreviewUrlRef.current) {
      URL.revokeObjectURL(documentPreviewUrlRef.current);
      documentPreviewUrlRef.current = '';
    }
  };

  const resetDocumentState = () => {
    clearPreviewUrl();
    setDocumentNaam('');
    setDocumentPreviewUrl('');
    setDocumentDragActive(false);
    setUploadingDocument(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitel('');
    setFormError('');
    resetDocumentState();
  };

  const loadDocument = async (recordId: number) => {
    resetDocumentState();
    try {
      const doc = await fetchNinoxStandaardDocumentBestand(recordId);
      if (!doc) {
        return;
      }
      const previewUrl = URL.createObjectURL(doc.blob);
      documentPreviewUrlRef.current = previewUrl;
      setDocumentNaam(doc.naam);
      setDocumentPreviewUrl(previewUrl);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'PDF laden mislukt.');
    }
  };

  useEffect(() => {
    void loadItems();
    return () => {
      clearPreviewUrl();
    };
  }, []);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => compareStrings(a.titel, b.titel, sort.direction));
  }, [items, sort]);

  const filteredItems = useMemo(() => {
    const terms = parseSearchTerms(zoek);
    if (terms.length === 0) {
      return sortedItems;
    }
    return sortedItems.filter((item) => matchesAllTerms(item.titel, terms));
  }, [sortedItems, zoek]);

  const closeModal = () => {
    setModalMode(null);
    resetForm();
  };

  const openNieuw = () => {
    resetForm();
    setModalMode('nieuw');
  };

  const openBewerk = async (item: StandaardDocument) => {
    setEditingId(item.id);
    setTitel(item.titel || '');
    setFormError('');
    setModalMode('bewerk');
    await loadDocument(item.id);
  };

  const handleOpenBewerkFromGrid = async (item: StandaardDocument) => {
    setOpeningRowId(item.id);
    await waitForNextPaint();
    try {
      await openBewerk(item);
    } finally {
      setOpeningRowId(null);
    }
  };

  const ensureRecordForDocumentUpload = async (bestand?: File): Promise<number> => {
    if (editingId) {
      return editingId;
    }

    const fallbackTitel = titel.trim() || titelUitBestandsnaam(bestand?.name || '') || 'Nieuw standaard document';
    const nieuwId = await createNinoxStandaardDocument({ titel: fallbackTitel });
    setEditingId(nieuwId);
    setModalMode('bewerk');
    setTitel(fallbackTitel);
    await loadItems();
    return nieuwId;
  };

  const uploadDocument = async (bestand?: File) => {
    if (!bestand) {
      return;
    }

    const isPdf = bestand.type === 'application/pdf' || bestand.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setFormError('Alleen PDF-bestanden zijn toegestaan.');
      return;
    }

    setFormError('');
    let recordId: number;
    try {
      recordId = await ensureRecordForDocumentUpload(bestand);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Automatisch opslaan van standaard document mislukt.');
      return;
    }

    clearPreviewUrl();
    const previewUrl = URL.createObjectURL(bestand);
    documentPreviewUrlRef.current = previewUrl;
    setDocumentNaam(bestand.name);
    setDocumentPreviewUrl(previewUrl);

    setUploadingDocument(true);
    try {
      await uploadNinoxStandaardDocumentBestand(recordId, bestand);
      await loadItems();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Document upload mislukt.');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDocumentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const bestand = Array.from(event.target.files || [])[0];
    event.target.value = '';
    await uploadDocument(bestand);
  };

  const handleDocumentDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (saving || uploadingDocument) {
      return;
    }
    setDocumentDragActive(true);
  };

  const handleDocumentDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDocumentDragActive(false);
    }
  };

  const handleDocumentDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDocumentDragActive(false);
    if (saving || uploadingDocument) {
      return;
    }
    const bestand = Array.from(event.dataTransfer.files || [])[0];
    await uploadDocument(bestand);
  };

  const openDocumentPicker = () => {
    documentInputRef.current?.click();
  };

  const handleDocumentOpen = async () => {
    setFormError('');
    if (documentPreviewUrl) {
      window.open(documentPreviewUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!editingId) {
      setFormError('Sla dit standaard document eerst op voordat een PDF geopend kan worden.');
      return;
    }
    try {
      const doc = await fetchNinoxStandaardDocumentBestand(editingId);
      if (!doc) {
        setFormError('Geen PDF gevonden voor dit documentveld.');
        return;
      }
      clearPreviewUrl();
      const previewUrl = URL.createObjectURL(doc.blob);
      documentPreviewUrlRef.current = previewUrl;
      setDocumentNaam(doc.naam);
      setDocumentPreviewUrl(previewUrl);
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'PDF openen mislukt.');
    }
  };

  const handleDocumentDelete = async () => {
    setFormError('');
    if (!editingId) {
      resetDocumentState();
      return;
    }

    setUploadingDocument(true);
    try {
      await clearNinoxStandaardDocumentBestand(editingId);
      resetDocumentState();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'PDF verwijderen mislukt.');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleSave = async () => {
    if (!titel.trim()) {
      setFormError('Titel is verplicht.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await updateNinoxStandaardDocument(editingId, { titel: titel.trim() });
      } else {
        await createNinoxStandaardDocument({ titel: titel.trim() });
      }
      await loadItems();
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const bevestigVervallen = async () => {
    if (!itemVoorVervallen) {
      return;
    }

    setDeletingId(itemVoorVervallen.id);
    setFormError('');
    try {
      await deleteNinoxStandaardDocument(itemVoorVervallen.id);
      setItemVoorVervallen(null);
      await loadItems();
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Vervallen mislukt.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Standaard Documenten</h1>
        </div>
        <p className="text-sm text-dc-gray-400">Tabel Standaard documenten ({items.length} records)</p>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={openNieuw}
          className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600"
        >
          Nieuw
        </button>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dc-gray-300" />
          <input
            type="text"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoeken op alle kolommen, meerdere kolommen zoeken mogelijk door je zoekwoorden met een , te scheiden..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-dc-gray-100 rounded-lg text-sm text-dc-gray-500 placeholder:text-dc-gray-300 focus:outline-none focus:ring-2 focus:ring-dc-blue-500/30 focus:border-dc-blue-500"
          />
        </div>
      </div>

      <LoadingSpinner active={loading} message="Standaard documenten laden uit Ninox..." />

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Ninox laden mislukt: {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dc-gray-100">
              <SortableTh
                label="Titel"
                active={sort.key === 'titel'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'titel'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id} className="dc-zebra-row dc-clickable-row" onClick={() => void handleOpenBewerkFromGrid(item)}>
                <td className="px-5 py-3 text-dc-gray-500">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex w-4 h-4 items-center justify-center shrink-0">
                      {openingRowId === item.id && <Loader2 className="w-4 h-4 text-dc-blue-500 animate-spin" />}
                    </span>
                    <span className="font-medium">{item.titel || '-'}</span>
                  </div>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td className="px-5 py-8 text-center text-dc-gray-300 text-sm">Geen standaard documenten gevonden</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalMode && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="w-full max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] bg-white rounded-xl border border-dc-gray-100 overflow-hidden flex flex-col"
            style={{ width: '768px', minWidth: '768px' }}
          >
            <div className="px-6 py-4 border-b border-dc-blue-500 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dc-gray-500">
                {modalMode === 'nieuw' ? 'Nieuw standaard document' : 'Standaard document bewerken'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded text-dc-gray-400 hover:text-dc-gray-500 hover:bg-dc-gray-50"
                aria-label="Sluiten"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <input
                ref={documentInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => void handleDocumentChange(event)}
                className="hidden"
              />

              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="md:col-span-6">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Titel</label>
                  <input
                    value={titel}
                    onChange={(e) => setTitel(e.target.value)}
                    placeholder="Titel"
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>

                <div className="md:col-span-6">
                  <div className="border-t border-red-500 my-1" />
                </div>

                <div className="md:col-span-6">
                  <div
                    onDragOver={handleDocumentDragOver}
                    onDragLeave={handleDocumentDragLeave}
                    onDrop={(event) => void handleDocumentDrop(event)}
                    className={`rounded-lg border p-4 transition-colors ${
                      documentDragActive ? 'border-dc-blue-500 bg-dc-blue-50/40' : 'border-dc-gray-100'
                    }`}
                  >
                    <label className="block text-xs font-medium text-dc-gray-400 mb-2">Document</label>
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                      <input
                        value={documentNaam}
                        readOnly
                        placeholder="Geen PDF gekozen"
                        className="flex-1 rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={openDocumentPicker}
                        disabled={uploadingDocument || saving}
                        className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {uploadingDocument ? 'Uploaden...' : 'Kies PDF'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDocumentOpen()}
                        disabled={uploadingDocument || (!documentNaam && !documentPreviewUrl)}
                        className="px-4 py-2 rounded-lg bg-yellow-400 text-black text-sm font-medium hover:bg-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Open PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDocumentDelete()}
                        disabled={uploadingDocument || (!editingId && !documentNaam)}
                        className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Verwijder PDF
                      </button>
                    </div>

                    <div
                      className={`mt-3 rounded-lg border border-dashed px-4 py-5 text-sm text-center transition-colors ${
                        documentDragActive
                          ? 'border-dc-blue-500 text-dc-blue-700 bg-[repeating-linear-gradient(180deg,rgba(250,204,21,0.22)_0px,rgba(250,204,21,0.22)_10px,rgba(59,130,246,0.18)_10px,rgba(59,130,246,0.18)_20px)]'
                          : 'border-dc-gray-200 text-dc-gray-500 bg-[repeating-linear-gradient(180deg,rgba(250,204,21,0.12)_0px,rgba(250,204,21,0.12)_10px,rgba(59,130,246,0.10)_10px,rgba(59,130,246,0.10)_20px)]'
                      }`}
                    >
                      {editingId
                        ? uploadingDocument
                          ? 'PDF uploaden...'
                          : 'Sleep hier een PDF naartoe of gebruik Kies PDF'
                        : uploadingDocument
                        ? 'Standaard document opslaan en PDF uploaden...'
                        : 'Sleep hier een PDF naartoe of gebruik Kies PDF. Het standaard document wordt automatisch opgeslagen.'}
                    </div>

                    {documentPreviewUrl && (
                      <div className="mt-2 border border-dc-gray-200 rounded-lg p-2 bg-white">
                        <object
                          data={documentInlinePreviewUrl}
                          type="application/pdf"
                          className="w-full h-40 rounded border border-dc-gray-200 bg-white"
                        >
                          <div className="text-xs text-dc-gray-400 px-2 py-1">Preview niet beschikbaar</div>
                        </object>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {formError && (
                <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-dc-blue-500 flex items-center justify-between gap-2">
              <div>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentItem = items.find((item) => item.id === editingId) ?? {
                        id: editingId,
                        titel,
                      };
                      setItemVoorVervallen(currentItem);
                    }}
                    disabled={Boolean(itemVoorVervallen && deletingId === editingId)}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {itemVoorVervallen && deletingId === editingId ? 'Bezig...' : 'Verwijderen'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving || uploadingDocument || deletingId === editingId}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-dc-gray-200 bg-white text-dc-gray-500 hover:bg-dc-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || uploadingDocument || deletingId === editingId}
                  className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                  {saving ? 'Bezig...' : editingId ? 'Bijwerken' : 'Opslaan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(itemVoorVervallen)}
        title="Verwijderen"
        message={itemVoorVervallen ? `Weet je zeker dat je standaard document "${itemVoorVervallen.titel || 'onbekend'}" wilt verwijderen?` : ''}
        confirmLabel="Verwijderen"
        confirming={itemVoorVervallen ? deletingId === itemVoorVervallen.id : false}
        onCancel={() => setItemVoorVervallen(null)}
        onConfirm={() => void bevestigVervallen()}
      />
    </div>
  );
}
