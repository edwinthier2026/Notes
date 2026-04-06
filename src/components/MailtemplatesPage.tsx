import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Bold, Eraser, FileText, Italic, List, ListOrdered, Loader2, Search, Underline } from 'lucide-react';
import type { MailTemplate } from '../types';
import {
  createNinoxMailTemplate,
  deleteNinoxMailTemplate,
  fetchNinoxMailTemplates,
  updateNinoxMailTemplate,
} from '../lib/ninox';
import { waitForNextPaint } from '../lib/render';
import { matchesAllTerms, parseSearchTerms } from '../lib/search';
import { compareStrings, nextSortState, type SortState } from '../lib/sort';
import ConfirmDialog from './ui/ConfirmDialog';
import LoadingSpinner from './ui/LoadingSpinner';
import SortableTh from './ui/SortableTh';

type GridSortKey = 'titel' | 'template';
const RICH_TEXT_COLOR_OPTIONS = ['#000000', '#C00000', '#0070C0', '#008000', '#7030A0', '#FF6600'];

function stripHtml(value: string): string {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function MailtemplatesPage() {
  const [items, setItems] = useState<MailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoek, setZoek] = useState('');
  const [sort, setSort] = useState<SortState<GridSortKey>>({ key: 'titel', direction: 'asc' });
  const [modalMode, setModalMode] = useState<'nieuw' | 'bewerk' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [openingRowId, setOpeningRowId] = useState<number | null>(null);
  const [templateVoorVerwijderen, setTemplateVoorVerwijderen] = useState<MailTemplate | null>(null);
  const [formError, setFormError] = useState('');
  const [titel, setTitel] = useState('');
  const [template, setTemplate] = useState('');
  const [memoExpanded, setMemoExpanded] = useState(false);
  const templateEditorRef = useRef<HTMLDivElement | null>(null);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sort.key === 'template') {
        return compareStrings(a.template || '', b.template || '', sort.direction);
      }
      return compareStrings(a.titel, b.titel, sort.direction);
    });
  }, [items, sort]);

  const filteredItems = useMemo(() => {
    const terms = parseSearchTerms(zoek);
    if (terms.length === 0) {
      return sortedItems;
    }
    return sortedItems.filter((item) => matchesAllTerms(`${item.titel} ${item.template || ''}`, terms));
  }, [sortedItems, zoek]);

  useEffect(() => {
    if (!modalMode || !templateEditorRef.current) {
      return;
    }
    if (templateEditorRef.current.innerHTML !== template) {
      templateEditorRef.current.innerHTML = template;
    }
  }, [modalMode, template]);

  const loadMailtemplates = async () => {
    setLoading(true);
    try {
      const data = await fetchNinoxMailTemplates();
      setItems(data);
      setError('');
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Onbekende Ninox fout');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMailtemplates();
  }, []);

  const resetForm = () => {
    setTitel('');
    setTemplate('');
    setMemoExpanded(false);
    setEditingId(null);
    setFormError('');
  };

  const closeModal = () => {
    setModalMode(null);
    resetForm();
  };

  const openNieuw = () => {
    resetForm();
    setModalMode('nieuw');
  };

  const openBewerk = async (mailTemplate: MailTemplate) => {
    setTitel(mailTemplate.titel);
    setTemplate(mailTemplate.template || '');
    setEditingId(mailTemplate.id);
    setFormError('');
    setModalMode('bewerk');
  };

  const handleOpenBewerkFromGrid = async (mailTemplate: MailTemplate) => {
    setOpeningRowId(mailTemplate.id);
    await waitForNextPaint();
    try {
      await openBewerk(mailTemplate);
    } finally {
      setOpeningRowId(null);
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
      if (modalMode === 'nieuw') {
        await createNinoxMailTemplate({
          titel: titel.trim(),
          template,
        });
      } else if (modalMode === 'bewerk' && editingId) {
        await updateNinoxMailTemplate(editingId, {
          titel: titel.trim(),
          template,
        });
      }
      await loadMailtemplates();
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const bevestigDelete = async () => {
    if (!templateVoorVerwijderen) {
      return;
    }
    setDeletingId(templateVoorVerwijderen.id);
    setError('');
    try {
      await deleteNinoxMailTemplate(templateVoorVerwijderen.id);
      setTemplateVoorVerwijderen(null);
      closeModal();
      await loadMailtemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verwijderen mislukt.');
    } finally {
      setDeletingId(null);
    }
  };

  const syncEditorHtml = () => {
    setTemplate(templateEditorRef.current?.innerHTML || '');
  };

  const execEditorCommand = (command: string, value?: string) => {
    if (!templateEditorRef.current || saving) {
      return;
    }
    templateEditorRef.current.focus();
    document.execCommand(command, false, value);
    syncEditorHtml();
  };

  const keepSelection = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const applyTextColor = (color: string) => {
    execEditorCommand('styleWithCSS', 'true');
    execEditorCommand('foreColor', color);
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Mailtemplates</h1>
        </div>
        <p className="text-sm text-dc-gray-400">Tabel MailTemplates ({items.length} records)</p>
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

      <LoadingSpinner active={loading} message="Mailtemplates laden uit Ninox..." />
      {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Ninox laden mislukt: {error}</div>}

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
              <SortableTh
                label="Template"
                active={sort.key === 'template'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'template'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id} className="dc-zebra-row dc-clickable-row" onClick={() => void handleOpenBewerkFromGrid(item)}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex w-4 h-4 items-center justify-center shrink-0">
                      {openingRowId === item.id && <Loader2 className="w-4 h-4 text-dc-blue-500 animate-spin" />}
                    </span>
                    <div>
                      <div className="font-medium text-dc-gray-500">{item.titel}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-dc-gray-400 max-w-[32rem]">
                  <div className="truncate" title={stripHtml(item.template || '')}>
                    {stripHtml(item.template || '') || '-'}
                  </div>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                  Geen mailtemplates gevonden
                </td>
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
            <div className="px-6 py-4 border-b border-dc-blue-500">
              <h2 className="text-lg font-semibold text-dc-gray-500">
                {modalMode === 'nieuw' ? 'Nieuw mailtemplate' : 'Mailtemplate bewerken'}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Titel</label>
                  <input
                    value={titel}
                    onChange={(e) => setTitel(e.target.value)}
                    placeholder="Titel"
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
                <div className="md:col-span-2" />

                <div className="md:col-span-6">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Template</label>
                  <div className="mb-2 flex flex-wrap items-center gap-1">
                    <button type="button" onMouseDown={keepSelection} onClick={() => execEditorCommand('bold')} className="rounded border border-dc-gray-200 px-2 py-1 text-dc-gray-500 hover:bg-dc-gray-50">
                      <Bold size={14} />
                    </button>
                    <button type="button" onMouseDown={keepSelection} onClick={() => execEditorCommand('italic')} className="rounded border border-dc-gray-200 px-2 py-1 text-dc-gray-500 hover:bg-dc-gray-50">
                      <Italic size={14} />
                    </button>
                    <button type="button" onMouseDown={keepSelection} onClick={() => execEditorCommand('underline')} className="rounded border border-dc-gray-200 px-2 py-1 text-dc-gray-500 hover:bg-dc-gray-50">
                      <Underline size={14} />
                    </button>
                    <button type="button" onMouseDown={keepSelection} onClick={() => execEditorCommand('insertUnorderedList')} className="rounded border border-dc-gray-200 px-2 py-1 text-dc-gray-500 hover:bg-dc-gray-50">
                      <List size={14} />
                    </button>
                    <button type="button" onMouseDown={keepSelection} onClick={() => execEditorCommand('insertOrderedList')} className="rounded border border-dc-gray-200 px-2 py-1 text-dc-gray-500 hover:bg-dc-gray-50">
                      <ListOrdered size={14} />
                    </button>
                    <button type="button" onMouseDown={keepSelection} onClick={() => execEditorCommand('removeFormat')} className="rounded border border-dc-gray-200 px-2 py-1 text-dc-gray-500 hover:bg-dc-gray-50">
                      <Eraser size={14} />
                    </button>
                    <div className="mx-1 h-5 w-px bg-dc-gray-200" />
                    {RICH_TEXT_COLOR_OPTIONS.map((color) => (
                      <button
                        key={`mailtemplate-color-${color}`}
                        type="button"
                        onMouseDown={keepSelection}
                        onClick={() => applyTextColor(color)}
                        className="h-6 w-6 rounded border border-dc-gray-200 hover:opacity-90"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="relative">
                    <div
                      ref={templateEditorRef}
                      contentEditable={!saving}
                      suppressContentEditableWarning
                      onInput={syncEditorHtml}
                      className={`dc-richtext-content dc-mail-richtext w-full overflow-y-auto rounded-lg border border-dc-gray-200 px-3 py-2 pr-10 text-sm outline-none focus:border-dc-blue-500 ${
                        memoExpanded ? 'h-72' : 'h-36'
                      }`}
                      style={{ color: '#000000' }}
                    />
                    <button
                      type="button"
                      onClick={() => setMemoExpanded((current) => !current)}
                      className="absolute right-2 top-2 p-1 text-red-600 hover:text-red-700"
                      title="Memo uitklappen"
                    >
                      <FileText size={16} />
                    </button>
                  </div>
                </div>

              </div>

              {formError && <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>}
            </div>

            <div className="border-t border-dc-blue-500 px-6 py-4 flex items-center justify-between gap-2">
              <div>
                {modalMode === 'bewerk' && editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentItem = items.find((item) => item.id === editingId);
                      if (currentItem) {
                        setTemplateVoorVerwijderen(currentItem);
                      }
                    }}
                    disabled={deletingId === editingId}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors dc-grid-delete-btn disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {deletingId === editingId ? 'Bezig...' : 'Verwijderen'}
                  </button>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-dc-gray-200 text-sm text-dc-gray-500 hover:bg-dc-gray-50"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                  {saving ? (modalMode === 'nieuw' ? 'Opslaan...' : 'Bijwerken...') : modalMode === 'nieuw' ? 'Opslaan' : 'Bijwerken'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(templateVoorVerwijderen)}
        title="Verwijderen"
        message={templateVoorVerwijderen ? `Weet je zeker dat je "${templateVoorVerwijderen.titel}" wilt verwijderen?` : ''}
        confirming={templateVoorVerwijderen ? deletingId === templateVoorVerwijderen.id : false}
        onCancel={() => setTemplateVoorVerwijderen(null)}
        onConfirm={() => void bevestigDelete()}
      />
    </div>
  );
}
