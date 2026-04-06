import { Building2, Loader2, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { RelatieInput, RelatieItem } from '../../types';
import { createRelatie, fetchRelaties } from '../../lib/api';
import { matchesAllTerms, parseSearchTerms } from '../../lib/search';
import { compareStrings, nextSortState, type SortState } from '../../lib/sort';
import SortableTh from '../../components/ui/SortableTh';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

type GridSortKey = 'naamRelatie' | 'groep' | 'straat' | 'postcode' | 'woonplaats';

const emptyForm: RelatieInput = {
  naamRelatie: '',
  groep: '',
  straat: '',
  postcode: '',
  woonplaats: '',
  opmerkingen: '',
};

export default function RelatiesTab() {
  const [items, setItems] = useState<RelatieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoek, setZoek] = useState('');
  const [sort, setSort] = useState<SortState<GridSortKey>>({ key: 'naamRelatie', direction: 'asc' });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<RelatieInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadRelaties = async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await fetchRelaties());
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Relaties laden mislukt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRelaties();
  }, []);

  const filteredItems = useMemo(() => {
    const terms = parseSearchTerms(zoek);
    const searched = items.filter((item) =>
      matchesAllTerms(
        `${item.naamRelatie} ${item.groep} ${item.straat} ${item.postcode} ${item.woonplaats} ${item.opmerkingen}`,
        terms
      )
    );

    return [...searched].sort((a, b) => {
      if (sort.key === 'groep') {
        return compareStrings(a.groep, b.groep, sort.direction);
      }
      if (sort.key === 'straat') {
        return compareStrings(a.straat, b.straat, sort.direction);
      }
      if (sort.key === 'postcode') {
        return compareStrings(a.postcode, b.postcode, sort.direction);
      }
      if (sort.key === 'woonplaats') {
        return compareStrings(a.woonplaats, b.woonplaats, sort.direction);
      }
      return compareStrings(a.naamRelatie, b.naamRelatie, sort.direction);
    });
  }, [items, sort, zoek]);

  const openNieuw = () => {
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(emptyForm);
    setFormError('');
  };

  const handleSave = async () => {
    if (!form.naamRelatie.trim()) {
      setFormError('Naam relatie is verplicht.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      await createRelatie({
        naamRelatie: form.naamRelatie.trim(),
        groep: form.groep.trim(),
        straat: form.straat.trim(),
        postcode: form.postcode.trim(),
        woonplaats: form.woonplaats.trim(),
        opmerkingen: form.opmerkingen.trim(),
      });
      await loadRelaties();
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Relatie opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Building2 size={24} className="text-dc-blue-500" />
          <h2 className="text-2xl font-semibold text-dc-gray-500">Relaties</h2>
        </div>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={openNieuw}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600"
        >
          <Plus size={16} />
          Nieuw
        </button>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dc-gray-300" />
          <input
            type="text"
            value={zoek}
            onChange={(event) => setZoek(event.target.value)}
            placeholder="Zoeken op alle kolommen, meerdere kolommen zoeken mogelijk door je zoekwoorden met een , te scheiden..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-dc-gray-100 rounded-lg text-sm text-dc-gray-500 placeholder:text-dc-gray-300 focus:outline-none focus:ring-2 focus:ring-dc-blue-500/30 focus:border-dc-blue-500"
          />
        </div>
      </div>

      <LoadingSpinner active={loading} message="Relaties laden uit MariaDB..." />
      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Relaties laden mislukt: {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dc-gray-100">
              <SortableTh
                label="Naam relatie"
                active={sort.key === 'naamRelatie'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'naamRelatie'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
              <SortableTh
                label="Groep"
                active={sort.key === 'groep'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'groep'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
              <SortableTh
                label="Straat"
                active={sort.key === 'straat'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'straat'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
              <SortableTh
                label="Postcode"
                active={sort.key === 'postcode'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'postcode'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
              <SortableTh
                label="Woonplaats"
                active={sort.key === 'woonplaats'}
                direction={sort.direction}
                onClick={() => setSort((current) => nextSortState(current, 'woonplaats'))}
                className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
              />
              <th className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase">Opmerkingen</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, index) => (
              <tr key={`${item.sleutel}-${index}`} className={index % 2 === 0 ? 'dc-zebra-row' : 'bg-white'}>
                <td className="px-5 py-3 text-dc-gray-500 font-medium">{item.naamRelatie || '-'}</td>
                <td className="px-5 py-3 text-dc-gray-500">{item.groep || '-'}</td>
                <td className="px-5 py-3 text-dc-gray-500">{item.straat || '-'}</td>
                <td className="px-5 py-3 text-dc-gray-500">{item.postcode || '-'}</td>
                <td className="px-5 py-3 text-dc-gray-500">{item.woonplaats || '-'}</td>
                <td className="px-5 py-3 text-dc-gray-500">
                  <div className="max-w-[24rem] truncate" title={item.opmerkingen || ''}>
                    {item.opmerkingen || '-'}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filteredItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-dc-gray-300 text-sm">
                  Geen relaties gevonden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="w-full max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] bg-white rounded-xl border border-dc-gray-100 overflow-hidden flex flex-col"
            style={{ width: '960px', minWidth: '960px' }}
          >
            <div className="px-6 py-4 border-b border-dc-blue-500">
              <h2 className="text-lg font-semibold text-dc-gray-500">Nieuwe relatie</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 min-h-[24rem]">
              <div className="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-3">
                <div className="md:col-span-8">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Naam relatie</label>
                  <input
                    value={form.naamRelatie}
                    onChange={(event) => setForm((current) => ({ ...current, naamRelatie: event.target.value }))}
                    placeholder="Naam relatie"
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
                <div className="md:col-span-8">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Groep</label>
                  <input
                    value={form.groep}
                    onChange={(event) => setForm((current) => ({ ...current, groep: event.target.value }))}
                    placeholder="Groep"
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
                <div className="md:col-span-8">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Straat</label>
                  <input
                    value={form.straat}
                    onChange={(event) => setForm((current) => ({ ...current, straat: event.target.value }))}
                    placeholder="Straat"
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Postcode</label>
                  <input
                    value={form.postcode}
                    onChange={(event) => setForm((current) => ({ ...current, postcode: event.target.value }))}
                    placeholder="Postcode"
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
                <div className="md:col-span-5">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Woonplaats</label>
                  <input
                    value={form.woonplaats}
                    onChange={(event) => setForm((current) => ({ ...current, woonplaats: event.target.value }))}
                    placeholder="Woonplaats"
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
                  />
                </div>
                <div className="md:col-span-16">
                  <label className="block text-xs font-medium text-dc-gray-400 mb-1">Opmerkingen</label>
                  <textarea
                    value={form.opmerkingen}
                    onChange={(event) => setForm((current) => ({ ...current, opmerkingen: event.target.value }))}
                    placeholder="Opmerkingen"
                    rows={7}
                    className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500 dc-memo-textarea"
                  />
                </div>
              </div>

              {formError && (
                <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}
            </div>

            <div className="border-t border-dc-blue-500 px-6 py-4 flex items-center justify-end gap-2">
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
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
