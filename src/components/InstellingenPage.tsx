import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Search, Settings, Globe, FileText, Loader2 } from 'lucide-react';
import {
  clearNinoxInstellingenDocument01,
  clearNinoxInstellingenDocument02,
  fetchNinoxInstellingenOverzicht,
  fetchNinoxInstellingenDocument01,
  fetchNinoxInstellingenDocument02,
  updateNinoxInstellingAlgemeen,
  uploadNinoxInstellingenDocument01,
  uploadNinoxInstellingenDocument02,
  type NinoxInstellingItem,
} from '../lib/ninox';
import SortableTh from './ui/SortableTh';
import { compareStrings, nextSortState, type SortState } from '../lib/sort';
import { matchesAllTerms, parseSearchTerms } from '../lib/search';
import { waitForNextPaint } from '../lib/render';
import LoadingSpinner from './ui/LoadingSpinner';

type InstellingenSortKey = 'factuurnummer' | 'naam';
type InstellingenTab = 'Algemeen' | 'Incasso' | 'Ninox' | 'Google' | 'Afbeeldingen' | 'Documenten';
interface AllowedFieldConfig {
  defaultLabel: string;
  aliases: string[];
}

export default function InstellingenPage() {
  const [items, setItems] = useState<NinoxInstellingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoek, setZoek] = useState('');
  const [sort, setSort] = useState<SortState<InstellingenSortKey>>({ key: 'naam', direction: 'asc' });
  const [openingRowId, setOpeningRowId] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<NinoxInstellingItem | null>(null);
  const [activeTab, setActiveTab] = useState<InstellingenTab>('Algemeen');
  const [naam, setNaam] = useState('');
  const [adres, setAdres] = useState('');
  const [postcode, setPostcode] = useState('');
  const [woonplaats, setWoonplaats] = useState('');
  const [kvkNummer, setKvkNummer] = useState('');
  const [lidnummer, setLidnummer] = useState('');
  const [factuurnummer, setFactuurnummer] = useState('');
  const [crediteuren, setCrediteuren] = useState('');
  const [debiteuren, setDebiteuren] = useState('');
  const [bank, setBank] = useState('');
  const [kas, setKas] = useState('');
  const [locatieLogoMail, setLocatieLogoMail] = useState('');
  const [locatieLogoFactuur, setLocatieLogoFactuur] = useState('');
  const [ninoxFieldValues, setNinoxFieldValues] = useState<Record<string, string>>({});
  const [googleFieldValues, setGoogleFieldValues] = useState<Record<string, string>>({});
  const [googleOpmerkingen, setGoogleOpmerkingen] = useState('');
  const [googleOpmerkingenFieldName, setGoogleOpmerkingenFieldName] = useState('Google opmerkingen');
  const [googleOpmerkingenExpanded, setGoogleOpmerkingenExpanded] = useState(false);
  const [incassantId, setIncassantId] = useState('');
  const [document01Naam, setDocument01Naam] = useState('');
  const [document01PreviewUrl, setDocument01PreviewUrl] = useState('');
  const [uploadingDocument01, setUploadingDocument01] = useState(false);
  const [document02Naam, setDocument02Naam] = useState('');
  const [document02PreviewUrl, setDocument02PreviewUrl] = useState('');
  const [uploadingDocument02, setUploadingDocument02] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const googleOpmerkingenRef = useRef<HTMLDivElement | null>(null);
  const document01InputRef = useRef<HTMLInputElement | null>(null);
  const document01PreviewUrlRef = useRef('');
  const document01LoadTokenRef = useRef(0);
  const document02InputRef = useRef<HTMLInputElement | null>(null);
  const document02PreviewUrlRef = useRef('');
  const document02LoadTokenRef = useRef(0);

  const normalizeFieldName = (value: string): string => value.toLowerCase().replace(/\s+/g, '').replace(/-/g, '').replace(/_/g, '');
  const googleAllowedFields: AllowedFieldConfig[] = [
    { defaultLabel: 'Google gebruikersnaam', aliases: ['Google gebruikersnaam', 'Google gebruiker', 'Google username'] },
    { defaultLabel: 'Google wachtwoord', aliases: ['Google wachtwoord', 'Google password'] },
    { defaultLabel: 'Google access token', aliases: ['Google access token', 'Google acces token', 'Google token'] },
    { defaultLabel: 'Google client secret', aliases: ['Google client secret', 'Google clientsecret', 'Google oauth client secret'] },
    { defaultLabel: 'Google refresh token', aliases: ['Google refresh token', 'Google refreshtoken', 'Google refresh'] },
    { defaultLabel: 'Google client id', aliases: ['Google client id', 'Google clientid', 'Google oauth client id'] },
    { defaultLabel: 'Google Console', aliases: ['Google Console', 'Google Console URL'] },
    { defaultLabel: 'Google agenda Planning', aliases: ['Google agenda Planning', 'Google calendar id Planning', 'Google agenda-id Planning', 'Google Planning'] },
    { defaultLabel: 'Google agenda Stofzuigen', aliases: ['Google agenda Stofzuigen', 'Google calendar id Stofzuigen', 'Google agenda-id Stofzuigen', 'Google Stofzuigen'] },
    { defaultLabel: 'Google agenda Onderwervoetbal', aliases: ['Google agenda Onderwervoetbal', 'Google agenda Onderwatervoetbal', 'Google calendar id Onderwatervoetbal', 'Google agenda-id Onderwatervoetbal', 'Google Onderwatervoetbal'] },
    { defaultLabel: 'Google agenda Toezichthouders', aliases: ['Google agenda Toezichthouders', 'Google calendar id Toezichthouders', 'Google agenda-id Toezichthouders', 'Google Toezichthouders'] },
    { defaultLabel: 'Google agenda Training geven', aliases: ['Google agenda Training geven', 'Google calendar id Training geven', 'Google agenda-id Training geven', 'Google Training geven'] },
    { defaultLabel: 'Google agenda Opleiding', aliases: ['Google agenda Opleiding', 'Google calendar id Opleiding', 'Google agenda-id Opleiding', 'Google Opleiding'] },
  ];
  const ninoxAllowedFields: AllowedFieldConfig[] = [
    { defaultLabel: 'Ninox api key', aliases: ['Ninox api key', 'NINOX_API_KEY'] },
    { defaultLabel: 'Ninox team id', aliases: ['Ninox team id', 'NINOX_TEAM_ID'] },
    { defaultLabel: 'Ninox database id', aliases: ['Ninox database id', 'NINOX_DATABASE_ID'] },
    { defaultLabel: 'Ninox website', aliases: ['Ninox website', 'Ninox website URL', 'Ninox URL'] },
    { defaultLabel: 'Ninox mailadres', aliases: ['Ninox mailadres', 'Ninox email', 'Ninox mail'] },
    { defaultLabel: 'Ninox wachtwoord', aliases: ['Ninox wachtwoord', 'Ninox password'] },
  ];

  const resolveAllowedFieldMap = (fields: Record<string, unknown>, configs: AllowedFieldConfig[]): Record<string, string> => {
    const asPrimitiveText = (value: unknown): string => {
      if (typeof value === 'string') {
        return value;
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
      if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const idFirst = [obj.id, obj.value, obj.key, obj.recordId];
        for (const candidate of idFirst) {
          if (typeof candidate === 'string' && candidate.trim()) {
            return candidate;
          }
          if (typeof candidate === 'number' && Number.isFinite(candidate)) {
            return String(candidate);
          }
        }
        const textFallback = [obj.caption, obj.label, obj.name, obj.text];
        for (const candidate of textFallback) {
          if (typeof candidate === 'string' && candidate.trim()) {
            return candidate;
          }
        }
      }
      return '';
    };

    const result: Record<string, string> = {};
    for (const config of configs) {
      const normalizedAliases = config.aliases.map((alias) => normalizeFieldName(alias));
      const matchedKey = Object.keys(fields).find((key) => normalizedAliases.includes(normalizeFieldName(key)));
      const rawValue = matchedKey ? fields[matchedKey] : '';
      result[config.defaultLabel] = asPrimitiveText(rawValue);
    }
    return result;
  };
  const isWebsiteField = (fieldName: string): boolean => {
    const normalized = normalizeFieldName(fieldName);
    return normalized === 'googleconsole' || normalized === 'googleconsoleurl' || normalized === 'ninoxwebsite' || normalized === 'ninoxwebsiteurl' || normalized === 'ninoxurl';
  };

  const normalizeWebsiteUrl = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    if (/^(https?:\/\/|mailto:)/i.test(trimmed)) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const openWebsite = (value: string) => {
    const href = normalizeWebsiteUrl(value);
    if (!href) {
      return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchNinoxInstellingenOverzicht();
      setItems(data);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Onbekende Ninox fout');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!googleOpmerkingenExpanded) {
      return;
    }
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (googleOpmerkingenRef.current && !googleOpmerkingenRef.current.contains(target)) {
        setGoogleOpmerkingenExpanded(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [googleOpmerkingenExpanded]);

  useEffect(() => {
    return () => {
      const prev01 = document01PreviewUrlRef.current;
      if (prev01) {
        URL.revokeObjectURL(prev01);
      }
      const prev02 = document02PreviewUrlRef.current;
      if (prev02) {
        URL.revokeObjectURL(prev02);
      }
    };
  }, []);

  const filtered = useMemo(() => {
    const terms = parseSearchTerms(zoek);
    if (terms.length === 0) {
      return items;
    }
    return items.filter((item) => {
      return matchesAllTerms(`${item.factuurnummer} ${item.naam}`, terms);
    });
  }, [items, zoek]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sort.key === 'factuurnummer') {
        return compareStrings(a.factuurnummer, b.factuurnummer, sort.direction);
      }
      return compareStrings(a.naam, b.naam, sort.direction);
    });
  }, [filtered, sort]);

  const googleOrderedEntries = useMemo(() => {
    const entries = Object.entries(googleFieldValues);
    const remaining = [...entries];
    const takeByAliases = (aliases: string[]): [string, string] | null => {
      const aliasSet = new Set(aliases);
      const index = remaining.findIndex(([key]) => aliasSet.has(normalizeFieldName(key)));
      if (index < 0) {
        return null;
      }
      const [picked] = remaining.splice(index, 1);
      return picked;
    };

    const ordered: Array<[string, string]> = [];
    const googleGebruikersnaam = takeByAliases([
      'googlegebruikersnaam',
      'googlegebruiker',
      'googleusername',
    ]);
    if (googleGebruikersnaam) {
      ordered.push(googleGebruikersnaam);
    }

    const googleAccessToken = takeByAliases([
      'googleaccesstoken',
      'googleacestoken',
      'googleaccesstoken',
      'googletoken',
    ]);
    if (googleAccessToken) {
      ordered.push(googleAccessToken);
    }

    const googleClientSecret = takeByAliases([
      'googleclientsecret',
      'googleoauthclientsecret',
    ]);
    if (googleClientSecret) {
      ordered.push(googleClientSecret);
    }

    const googleRefreshToken = takeByAliases([
      'googlerefreshtoken',
      'googlerefresh',
    ]);
    if (googleRefreshToken) {
      ordered.push(googleRefreshToken);
    }

    return [...ordered, ...remaining];
  }, [googleFieldValues]);

  // Document - 01 handlers
  const resetDocument01State = () => {
    const prev = document01PreviewUrlRef.current;
    if (prev) {
      URL.revokeObjectURL(prev);
    }
    document01PreviewUrlRef.current = '';
    setDocument01PreviewUrl('');
    setDocument01Naam('');
    if (document01InputRef.current) {
      document01InputRef.current.value = '';
    }
  };

  const laadBestaandDocument01 = async (recordId: number) => {
    const token = ++document01LoadTokenRef.current;
    try {
      const doc = await fetchNinoxInstellingenDocument01(recordId);
      if (token !== document01LoadTokenRef.current) {
        return;
      }
      if (!doc) {
        resetDocument01State();
        return;
      }
      const url = URL.createObjectURL(doc.blob);
      const prev = document01PreviewUrlRef.current;
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      document01PreviewUrlRef.current = url;
      setDocument01PreviewUrl(url);
      setDocument01Naam(doc.naam);
    } catch {
      if (token === document01LoadTokenRef.current) {
        resetDocument01State();
      }
    }
  };

  const openDocument01Picker = () => {
    document01InputRef.current?.click();
  };

  const handleDocument01Change = async (event: ChangeEvent<HTMLInputElement>) => {
    const bestand = event.target.files?.[0];
    if (!bestand) {
      return;
    }
    const isPdf = bestand.type === 'application/pdf' || bestand.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setFormError('Alleen PDF-bestanden zijn toegestaan.');
      return;
    }
    if (!editingItem) {
      return;
    }

    setFormError('');
    setDocument01Naam(bestand.name);
    const previewUrl = URL.createObjectURL(bestand);
    const prev = document01PreviewUrlRef.current;
    if (prev) {
      URL.revokeObjectURL(prev);
    }
    document01PreviewUrlRef.current = previewUrl;
    setDocument01PreviewUrl(previewUrl);

    setUploadingDocument01(true);
    try {
      await uploadNinoxInstellingenDocument01(editingItem.id, bestand);
      void laadBestaandDocument01(editingItem.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Uploaden van PDF mislukt.');
    } finally {
      setUploadingDocument01(false);
    }
  };

  const handleDocument01Delete = async () => {
    if (!editingItem) {
      return;
    }
    setFormError('');
    setUploadingDocument01(true);
    try {
      await clearNinoxInstellingenDocument01(editingItem.id);
      resetDocument01State();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Verwijderen van PDF mislukt.');
    } finally {
      setUploadingDocument01(false);
    }
  };

  const handleDocument01Open = async () => {
    if (document01PreviewUrl) {
      window.open(document01PreviewUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!editingItem) {
      return;
    }
    setUploadingDocument01(true);
    try {
      const doc = await fetchNinoxInstellingenDocument01(editingItem.id);
      if (!doc) {
        return;
      }
      const url = URL.createObjectURL(doc.blob);
      const prev = document01PreviewUrlRef.current;
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      document01PreviewUrlRef.current = url;
      setDocument01PreviewUrl(url);
      setDocument01Naam(doc.naam);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setUploadingDocument01(false);
    }
  };

  // Document - 02 handlers
  const resetDocument02State = () => {
    const prev = document02PreviewUrlRef.current;
    if (prev) {
      URL.revokeObjectURL(prev);
    }
    document02PreviewUrlRef.current = '';
    setDocument02PreviewUrl('');
    setDocument02Naam('');
    if (document02InputRef.current) {
      document02InputRef.current.value = '';
    }
  };

  const laadBestaandDocument02 = async (recordId: number) => {
    const token = ++document02LoadTokenRef.current;
    try {
      const doc = await fetchNinoxInstellingenDocument02(recordId);
      if (token !== document02LoadTokenRef.current) {
        return;
      }
      if (!doc) {
        resetDocument02State();
        return;
      }
      const url = URL.createObjectURL(doc.blob);
      const prev = document02PreviewUrlRef.current;
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      document02PreviewUrlRef.current = url;
      setDocument02PreviewUrl(url);
      setDocument02Naam(doc.naam);
    } catch {
      if (token === document02LoadTokenRef.current) {
        resetDocument02State();
      }
    }
  };

  const laadBestaandeDocumenten = async (recordId: number) => {
    await Promise.all([
      laadBestaandDocument01(recordId),
      laadBestaandDocument02(recordId),
    ]);
  };

  const openDocument02Picker = () => {
    document02InputRef.current?.click();
  };

  const handleDocument02Change = async (event: ChangeEvent<HTMLInputElement>) => {
    const bestand = event.target.files?.[0];
    if (!bestand) {
      return;
    }
    const isPdf = bestand.type === 'application/pdf' || bestand.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setFormError('Alleen PDF-bestanden zijn toegestaan.');
      return;
    }
    if (!editingItem) {
      return;
    }

    setFormError('');
    setDocument02Naam(bestand.name);
    const previewUrl = URL.createObjectURL(bestand);
    const prev = document02PreviewUrlRef.current;
    if (prev) {
      URL.revokeObjectURL(prev);
    }
    document02PreviewUrlRef.current = previewUrl;
    setDocument02PreviewUrl(previewUrl);

    setUploadingDocument02(true);
    try {
      await uploadNinoxInstellingenDocument02(editingItem.id, bestand);
      void laadBestaandDocument02(editingItem.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Uploaden van PDF mislukt.');
    } finally {
      setUploadingDocument02(false);
    }
  };

  const handleDocument02Delete = async () => {
    if (!editingItem) {
      return;
    }
    setFormError('');
    setUploadingDocument02(true);
    try {
      await clearNinoxInstellingenDocument02(editingItem.id);
      resetDocument02State();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Verwijderen van PDF mislukt.');
    } finally {
      setUploadingDocument02(false);
    }
  };

  const handleDocument02Open = async () => {
    if (document02PreviewUrl) {
      window.open(document02PreviewUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!editingItem) {
      return;
    }
    setUploadingDocument02(true);
    try {
      const doc = await fetchNinoxInstellingenDocument02(editingItem.id);
      if (!doc) {
        return;
      }
      const url = URL.createObjectURL(doc.blob);
      const prev = document02PreviewUrlRef.current;
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      document02PreviewUrlRef.current = url;
      setDocument02PreviewUrl(url);
      setDocument02Naam(doc.naam);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setUploadingDocument02(false);
    }
  };

  const openBewerk = async (item: NinoxInstellingItem) => {
    const fields = item.rawFields || {};
    const readField = (aliases: string[]): string => {
      const asPrimitiveText = (value: unknown): string => {
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          return String(value);
        }
        return '';
      };

      const extract = (value: unknown): string => {
        const direct = asPrimitiveText(value);
        if (direct) {
          return direct;
        }
        if (Array.isArray(value) && value.length > 0) {
          return extract(value[0]);
        }
        if (value && typeof value === 'object') {
          const obj = value as Record<string, unknown>;
          const idFirst = [obj.id, obj.value, obj.key, obj.recordId];
          for (const candidate of idFirst) {
            const parsed = asPrimitiveText(candidate);
            if (parsed) {
              return parsed;
            }
          }
          const textFallback = [obj.caption, obj.label, obj.name, obj.text];
          for (const candidate of textFallback) {
            const parsed = asPrimitiveText(candidate);
            if (parsed) {
              return parsed;
            }
          }
        }
        return '';
      };

      for (const alias of aliases) {
        const extracted = extract(fields[alias]);
        if (extracted) {
          return extracted;
        }
      }
      return '';
    };

    setActiveTab('Algemeen');
    setNaam(item.naam || '');
    setAdres(item.adres || '');
    setPostcode(item.postcode || '');
    setWoonplaats(item.woonplaats || '');
    setKvkNummer(readField(['KvK nummer', 'Kvk nummer', 'Kvknummer', 'KvK']));
    setLidnummer(readField(['Lidnummer', 'Lid nummer']));
    setFactuurnummer(readField(['Factuurnummer', 'Factuur nummer']) || item.factuurnummer || '');
    setCrediteuren(readField(['Crediteuren']));
    setDebiteuren(readField(['Debiteuren']));
    setBank(readField(['Bank']));
    setKas(readField(['Kas']));
    setLocatieLogoMail(readField(['Locatie logo mail', 'Logo mail locatie']));
    setLocatieLogoFactuur(readField(['Locatie logo factuur', 'Logo factuur locatie']));
    setIncassantId(readField(['Incassant id', 'Incassantid', 'Incassant ID']));

    const asPrimitiveText = (value: unknown): string => {
      if (typeof value === 'string') {
        return value;
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
      if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const idFirst = [obj.id, obj.value, obj.key, obj.recordId];
        for (const candidate of idFirst) {
          if (typeof candidate === 'string' && candidate.trim()) {
            return candidate;
          }
          if (typeof candidate === 'number' && Number.isFinite(candidate)) {
            return String(candidate);
          }
        }
        const textFallback = [obj.caption, obj.label, obj.name, obj.text];
        for (const candidate of textFallback) {
          if (typeof candidate === 'string' && candidate.trim()) {
            return candidate;
          }
        }
      }
      return '';
    };

    setNinoxFieldValues(resolveAllowedFieldMap(fields, ninoxAllowedFields));

    setGoogleFieldValues(resolveAllowedFieldMap(fields, googleAllowedFields));

    const opmerkingenEntry = Object.entries(fields).find(([key]) => normalizeFieldName(key) === 'googleopmerkingen');
    setGoogleOpmerkingenFieldName(opmerkingenEntry?.[0] || 'Google opmerkingen');
    setGoogleOpmerkingen(opmerkingenEntry ? asPrimitiveText(opmerkingenEntry[1]) : '');
    setGoogleOpmerkingenExpanded(false);

    resetDocument01State();
    resetDocument02State();
    await laadBestaandeDocumenten(item.id);
    setEditingItem(item);
  };

  const handleOpenBewerkFromGrid = async (item: NinoxInstellingItem) => {
    setOpeningRowId(item.id);
    await waitForNextPaint();
    try {
      await openBewerk(item);
    } finally {
      setOpeningRowId(null);
    }
  };

  const closeBewerk = () => {
    if (saving) {
      return;
    }
    resetDocument01State();
    resetDocument02State();
    setEditingItem(null);
    setFormError('');
  };

  const handleBijwerken = async () => {
    if (!editingItem) {
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await updateNinoxInstellingAlgemeen(editingItem.id, {
        naam,
        adres,
        postcode,
        woonplaats,
        kvkNummer,
        lidnummer,
        factuurnummer,
        crediteuren,
        debiteuren,
        bank,
        kas,
        locatieLogoMail,
        locatieLogoFactuur,
        incassantId,
        extraFields: {
          ...ninoxFieldValues,
          ...googleFieldValues,
          [googleOpmerkingenFieldName]: googleOpmerkingen,
        },
        rawFields: editingItem.rawFields,
      });
      await load();
      closeBewerk();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Settings size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Instellingen</h1>
        </div>
        <p className="text-sm text-dc-gray-400">Overzicht van de instellingen</p>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dc-gray-300" />
          <input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
                placeholder="Zoeken op alle kolommen, meerdere kolommen zoeken mogelijk door je zoekwoorden met een , te scheiden..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-dc-gray-100 rounded-lg text-sm text-dc-gray-500 placeholder:text-dc-gray-300 focus:outline-none focus:ring-2 focus:ring-dc-blue-500/30 focus:border-dc-blue-500"
          />
        </div>
      </div>

      <LoadingSpinner active={loading} message="Instellingen laden uit Ninox..." />
      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Ninox laden mislukt: {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-dc-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dc-gray-100">
                <SortableTh
                  label="Laatste factuurnummer"
                  active={sort.key === 'factuurnummer'}
                  direction={sort.direction}
                  onClick={() => setSort((current) => nextSortState(current, 'factuurnummer'))}
                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                />
                <SortableTh
                  label="Naam"
                  active={sort.key === 'naam'}
                  direction={sort.direction}
                  onClick={() => setSort((current) => nextSortState(current, 'naam'))}
                  className="text-left px-5 py-3 text-xs font-semibold text-dc-gray-400 uppercase"
                />
                
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <tr key={item.id} className="dc-zebra-row dc-clickable-row hover:bg-dc-gray-100 transition-colors" onClick={() => void handleOpenBewerkFromGrid(item)}>
                  <td className="px-5 py-3 text-dc-gray-500"><span className="inline-flex items-center gap-2"><span className="inline-flex w-4 h-4 items-center justify-center shrink-0">{openingRowId === item.id && <Loader2 className="w-4 h-4 text-dc-blue-500 animate-spin" />}</span>{item.factuurnummer || '-'}</span></td>
                  <td className="px-5 py-3 text-dc-gray-500">{item.naam || '-'}</td>

                </tr>
              ))}
              {!loading && sorted.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-5 py-6 text-center text-dc-gray-300">
                    Geen instellingen gevonden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4">
          <div className="w-full max-w-6xl bg-white rounded-xl border border-dc-gray-100 shadow-xl p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-dc-gray-500">Instellingen</h2>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {(['Algemeen', 'Incasso', 'Ninox', 'Google', 'Afbeeldingen', 'Documenten'] as InstellingenTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    activeTab === tab ? 'bg-dc-blue-500 text-white' : 'text-dc-gray-400 hover:text-dc-gray-500'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 min-h-[28rem]">
              {activeTab === 'Algemeen' && (
                <>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Naam</label>
                    <input
                      value={naam}
                      onChange={(e) => setNaam(e.target.value)}
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Adres</label>
                    <input
                      value={adres}
                      onChange={(e) => setAdres(e.target.value)}
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Postcode</label>
                    <input
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value)}
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Woonplaats</label>
                    <input
                      value={woonplaats}
                      onChange={(e) => setWoonplaats(e.target.value)}
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs font-semibold text-dc-gray-400">KvK nummer</label>
                    <input
                      value={kvkNummer}
                      onChange={(e) => setKvkNummer(e.target.value)}
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Lidnummer</label>
                    <input
                      value={lidnummer}
                      onChange={(e) => setLidnummer(e.target.value)}
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-6 border-t border-red-500 my-1" />
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Laatste factuurnummer</label>
                    <input
                      value={factuurnummer}
                      onChange={(e) => setFactuurnummer(e.target.value)}
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Crediteuren</label>
                    <input
                      value={crediteuren}
                      onChange={(e) => setCrediteuren(e.target.value)}
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Debiteuren</label>
                    <input
                      value={debiteuren}
                      onChange={(e) => setDebiteuren(e.target.value)}
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Bank</label>
                    <input
                      value={bank}
                      onChange={(e) => setBank(e.target.value)}
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Kas</label>
                    <input
                      value={kas}
                      onChange={(e) => setKas(e.target.value)}
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                    />
                  </div>
                  <div className="md:col-span-1" />
                </>
              )}

              {activeTab === 'Incasso' && (
                <>
                  {/* Rij 1: Incassant id */}
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Incassant id</label>
                    <input
                      value={incassantId}
                      onChange={(e) => setIncassantId(e.target.value)}
                      className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                      placeholder="Bijv. NL71ZZZ403970070000"
                    />
                  </div>
                </>
              )}

              {activeTab !== 'Algemeen' && activeTab !== 'Incasso' && (
                <>
                  {activeTab !== 'Afbeeldingen' && (
                    <>
                      {activeTab !== 'Ninox' &&
                        activeTab !== 'Google' &&
                        activeTab !== 'Documenten' && (
                        <div className="md:col-span-6 rounded-lg border border-dc-gray-100 bg-dc-gray-50 p-4 text-sm text-dc-gray-400 min-h-[220px]">
                          Tabblad: {activeTab}
                        </div>
                      )}
                      {activeTab === 'Ninox' && (
                        <>
                          <div className="md:col-span-3">
                            <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Ninox api key</label>
                            <input
                              value={ninoxFieldValues['Ninox api key'] || ''}
                              onChange={(e) =>
                                setNinoxFieldValues((current) => ({
                                  ...current,
                                  'Ninox api key': e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Ninox team id</label>
                            <input
                              value={ninoxFieldValues['Ninox team id'] || ''}
                              onChange={(e) =>
                                setNinoxFieldValues((current) => ({
                                  ...current,
                                  'Ninox team id': e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Ninox database id</label>
                            <input
                              value={ninoxFieldValues['Ninox database id'] || ''}
                              onChange={(e) =>
                                setNinoxFieldValues((current) => ({
                                  ...current,
                                  'Ninox database id': e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Ninox website</label>
                            <div className="relative">
                              <input
                                value={ninoxFieldValues['Ninox website'] || ''}
                                onChange={(e) =>
                                  setNinoxFieldValues((current) => ({
                                    ...current,
                                    'Ninox website': e.target.value,
                                  }))
                                }
                                className="w-full rounded-lg border border-dc-gray-200 px-3 pr-10 py-2 text-sm text-dc-gray-500"
                              />
                              <button
                                type="button"
                                onClick={() => openWebsite(ninoxFieldValues['Ninox website'] || '')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-600 disabled:opacity-40"
                                disabled={!(ninoxFieldValues['Ninox website'] || '').trim()}
                                title="Open URL"
                                aria-label="Open URL"
                              >
                                <Globe size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="md:col-span-3">
                            <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Ninox mailadres</label>
                            <input
                              value={ninoxFieldValues['Ninox mailadres'] || ''}
                              onChange={(e) =>
                                setNinoxFieldValues((current) => ({
                                  ...current,
                                  'Ninox mailadres': e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Ninox wachtwoord</label>
                            <input
                              value={ninoxFieldValues['Ninox wachtwoord'] || ''}
                              onChange={(e) =>
                                setNinoxFieldValues((current) => ({
                                  ...current,
                                  'Ninox wachtwoord': e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                            />
                          </div>
                        </>
                      )}
                      {activeTab === 'Google' && (
                        <>
                          {googleOrderedEntries.length > 0 ? (
                            <>
                              {(() => {
                                const findGoogleKey = (aliases: string[], fallback: string): string => {
                                  const aliasSet = new Set(aliases.map((alias) => normalizeFieldName(alias)));
                                  const match = Object.keys(googleFieldValues).find((key) => aliasSet.has(normalizeFieldName(key)));
                                  return match || fallback;
                                };
                                const gebruikersnaamKey = findGoogleKey(
                                  ['Google gebruikersnaam', 'Google gebruiker', 'Google username'],
                                  'Google gebruikersnaam'
                                );
                                const wachtwoordKey = findGoogleKey(
                                  ['Google wachtwoord', 'Google password'],
                                  'Google wachtwoord'
                                );
                                const accessTokenKey = findGoogleKey(
                                  ['Google access token', 'Google acces token', 'Google token'],
                                  'Google access token'
                                );
                                const clientSecretKey = findGoogleKey(
                                  ['Google client secret', 'Google clientsecret', 'Google oauth client secret'],
                                  'Google client secret'
                                );
                                const refreshTokenKey = findGoogleKey(
                                  ['Google refresh token', 'Google refreshtoken', 'Google refresh'],
                                  'Google refresh token'
                                );
                                const clientIdKey = findGoogleKey(
                                  ['Google client id', 'Google clientid', 'Google oauth client id'],
                                  'Google client id'
                                );
                                const consoleKey = findGoogleKey(['Google Console', 'Google Console URL'], 'Google Console');
                                const agendaPlanningKey = findGoogleKey(
                                  ['Google agenda Planning', 'Google calendar id Planning', 'Google agenda-id Planning', 'Google Planning'],
                                  'Google agenda Planning'
                                );
                                const agendaStofzuigenKey = findGoogleKey(
                                  ['Google agenda Stofzuigen', 'Google calendar id Stofzuigen', 'Google agenda-id Stofzuigen', 'Google Stofzuigen'],
                                  'Google agenda Stofzuigen'
                                );
                                const agendaOnderwatervoetbalKey = findGoogleKey(
                                  ['Google agenda Onderwervoetbal', 'Google agenda Onderwatervoetbal', 'Google calendar id Onderwatervoetbal', 'Google agenda-id Onderwatervoetbal', 'Google Onderwatervoetbal'],
                                  'Google agenda Onderwervoetbal'
                                );
                                const agendaToezichthoudersKey = findGoogleKey(
                                  ['Google agenda Toezichthouders', 'Google calendar id Toezichthouders', 'Google agenda-id Toezichthouders', 'Google Toezichthouders'],
                                  'Google agenda Toezichthouders'
                                );
                                const agendaTrainingGevenKey = findGoogleKey(
                                  ['Google agenda Training geven', 'Google calendar id Training geven', 'Google agenda-id Training geven', 'Google Training geven'],
                                  'Google agenda Training geven'
                                );
                                const agendaOpleidingKey = findGoogleKey(
                                  ['Google agenda Opleiding', 'Google calendar id Opleiding', 'Google agenda-id Opleiding', 'Google Opleiding'],
                                  'Google agenda Opleiding'
                                );

                                const fixedKeys = new Set([
                                  gebruikersnaamKey,
                                  wachtwoordKey,
                                  accessTokenKey,
                                  clientSecretKey,
                                  refreshTokenKey,
                                  clientIdKey,
                                  consoleKey,
                                  agendaPlanningKey,
                                  agendaStofzuigenKey,
                                  agendaOnderwatervoetbalKey,
                                  agendaToezichthoudersKey,
                                  agendaTrainingGevenKey,
                                  agendaOpleidingKey,
                                ]);
                                const restEntries = googleOrderedEntries.filter(([key]) => !fixedKeys.has(key));

                                const renderGoogleInput = (fieldKey: string, spanClass: string) => {
                                  const fieldValue = googleFieldValues[fieldKey] || '';
                                  return (
                                    <div key={fieldKey} className={spanClass}>
                                      <label className="mb-1 block text-xs font-semibold text-dc-gray-400">{fieldKey}</label>
                                      {isWebsiteField(fieldKey) ? (
                                        <div className="relative">
                                          <input
                                            value={fieldValue}
                                            onChange={(e) =>
                                              setGoogleFieldValues((current) => ({
                                                ...current,
                                                [fieldKey]: e.target.value,
                                              }))
                                            }
                                            className="w-full rounded-lg border border-dc-gray-200 px-3 pr-10 py-2 text-sm text-dc-gray-500"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => openWebsite(fieldValue)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-600 disabled:opacity-40"
                                            disabled={!fieldValue.trim()}
                                            title="Open URL"
                                            aria-label="Open URL"
                                          >
                                            <Globe size={16} />
                                          </button>
                                        </div>
                                      ) : (
                                        <input
                                          value={fieldValue}
                                          onChange={(e) =>
                                            setGoogleFieldValues((current) => ({
                                              ...current,
                                              [fieldKey]: e.target.value,
                                            }))
                                          }
                                          className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                                        />
                                      )}
                                    </div>
                                  );
                                };

                                return (
                                  <>
                                    {renderGoogleInput(gebruikersnaamKey, 'md:col-span-3')}
                                    {renderGoogleInput(wachtwoordKey, 'md:col-span-3')}
                                    {renderGoogleInput(accessTokenKey, 'md:col-span-3')}
                                    {renderGoogleInput(clientSecretKey, 'md:col-span-3')}
                                    {renderGoogleInput(refreshTokenKey, 'md:col-span-3')}
                                    {renderGoogleInput(clientIdKey, 'md:col-span-2')}
                                    {renderGoogleInput(consoleKey, 'md:col-span-4')}
                                    <div className="col-span-1 md:col-span-6 border-t border-red-500 my-1" />
                                    {renderGoogleInput(agendaPlanningKey, 'md:col-span-3')}
                                    {renderGoogleInput(agendaStofzuigenKey, 'md:col-span-3')}
                                    {renderGoogleInput(agendaOnderwatervoetbalKey, 'md:col-span-3')}
                                    {renderGoogleInput(agendaToezichthoudersKey, 'md:col-span-3')}
                                    {renderGoogleInput(agendaTrainingGevenKey, 'md:col-span-3')}
                                    {renderGoogleInput(agendaOpleidingKey, 'md:col-span-3')}
                                    {restEntries.length > 0 && <div className="col-span-1 md:col-span-6 border-t border-red-500 my-1" />}
                                    {restEntries.map(([fieldName, fieldValue]) => (
                                      <div key={fieldName} className="md:col-span-3">
                                        <label className="mb-1 block text-xs font-semibold text-dc-gray-400">{fieldName}</label>
                                        {isWebsiteField(fieldName) ? (
                                          <div className="relative">
                                            <input
                                              value={fieldValue}
                                              onChange={(e) =>
                                                setGoogleFieldValues((current) => ({
                                                  ...current,
                                                  [fieldName]: e.target.value,
                                                }))
                                              }
                                              className="w-full rounded-lg border border-dc-gray-200 px-3 pr-10 py-2 text-sm text-dc-gray-500"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => openWebsite(fieldValue)}
                                              className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-600 disabled:opacity-40"
                                              disabled={!fieldValue.trim()}
                                              title="Open URL"
                                              aria-label="Open URL"
                                            >
                                              <Globe size={16} />
                                            </button>
                                          </div>
                                        ) : (
                                          <input
                                            value={fieldValue}
                                            onChange={(e) =>
                                              setGoogleFieldValues((current) => ({
                                                ...current,
                                                [fieldName]: e.target.value,
                                              }))
                                            }
                                            className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500"
                                          />
                                        )}
                                      </div>
                                    ))}
                                  </>
                                );
                              })()}
                              <div className="col-span-1 md:col-span-6 border-t border-red-500 my-1" />
                            </>
                          ) : (
                            <div className="md:col-span-6 rounded-lg border border-dc-gray-100 bg-dc-gray-50 p-4 text-sm text-dc-gray-400">
                              Geen Google velden gevonden.
                            </div>
                          )}
                          <div className="md:col-span-6">
                            <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Google opmerkingen</label>
                            <div ref={googleOpmerkingenRef} className="relative">
                              <textarea
                                rows={3}
                                value={googleOpmerkingen}
                                onFocus={() => setGoogleOpmerkingenExpanded(true)}
                                onChange={(e) => setGoogleOpmerkingen(e.target.value)}
                                className={`dc-memo-textarea w-full rounded-lg border border-dc-gray-200 pr-10 px-3 py-2 text-sm outline-none focus:border-dc-blue-500 ${
                                  googleOpmerkingenExpanded ? 'h-48 resize-y' : 'h-24 resize-none'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setGoogleOpmerkingenExpanded((current) => !current)}
                                className="absolute right-2 top-2 text-red-500 hover:text-red-600"
                                title="Memo uitklappen"
                                aria-label="Memo uitklappen"
                              >
                                <FileText size={16} />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                      {activeTab === 'Documenten' && (
                        <>
                          {/* Hidden inputs */}
                          <input
                            ref={document01InputRef}
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={(event) => void handleDocument01Change(event)}
                            className="hidden"
                          />
                          <input
                            ref={document02InputRef}
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={(event) => void handleDocument02Change(event)}
                            className="hidden"
                          />

                          {/* Document - 01 */}
                          <div className="md:col-span-6">
                            <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Document - 01</label>
                            <div className="flex items-center gap-2">
                              <input
                                value={document01Naam}
                                readOnly
                                placeholder="Geen PDF gekozen"
                                className="flex-1 rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500 bg-white"
                              />
                              <button
                                type="button"
                                onClick={openDocument01Picker}
                                disabled={uploadingDocument01 || saving}
                                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {uploadingDocument01 ? 'Uploaden...' : 'Kies PDF'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDocument01Open()}
                                disabled={uploadingDocument01 || (!document01Naam && !document01PreviewUrl)}
                                className="px-4 py-2 rounded-lg bg-yellow-400 text-black text-sm font-medium hover:bg-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                Open PDF
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDocument01Delete()}
                                disabled={uploadingDocument01 || !document01Naam}
                                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                Verwijder PDF
                              </button>
                            </div>
                          </div>

                          {/* Document - 02 */}
                          <div className="md:col-span-6">
                            <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Document - 02</label>
                            <div className="flex items-center gap-2">
                              <input
                                value={document02Naam}
                                readOnly
                                placeholder="Geen PDF gekozen"
                                className="flex-1 rounded-lg border border-dc-gray-200 px-3 py-2 text-sm text-dc-gray-500 bg-white"
                              />
                              <button
                                type="button"
                                onClick={openDocument02Picker}
                                disabled={uploadingDocument02 || saving}
                                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {uploadingDocument02 ? 'Uploaden...' : 'Kies PDF'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDocument02Open()}
                                disabled={uploadingDocument02 || (!document02Naam && !document02PreviewUrl)}
                                className="px-4 py-2 rounded-lg bg-yellow-400 text-black text-sm font-medium hover:bg-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                Open PDF
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDocument02Delete()}
                                disabled={uploadingDocument02 || !document02Naam}
                                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                Verwijder PDF
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {activeTab === 'Afbeeldingen' && (
                    <>
                      <div className="md:col-span-6">
                        <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Locatie logo mail</label>
                        <div className="relative">
                          <input
                            value={locatieLogoMail}
                            onChange={(e) => setLocatieLogoMail(e.target.value)}
                            className="w-full rounded-lg border border-dc-gray-200 px-3 pr-10 py-2 text-sm text-dc-gray-500"
                          />
                          <button
                            type="button"
                            onClick={() => openWebsite(locatieLogoMail)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-600 disabled:opacity-40"
                            disabled={!locatieLogoMail.trim()}
                            title="Open URL"
                            aria-label="Open URL"
                          >
                            <Globe size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="md:col-span-6">
                        <label className="mb-1 block text-xs font-semibold text-dc-gray-400">Locatie logo factuur</label>
                        <div className="relative">
                          <input
                            value={locatieLogoFactuur}
                            onChange={(e) => setLocatieLogoFactuur(e.target.value)}
                            className="w-full rounded-lg border border-dc-gray-200 px-3 pr-10 py-2 text-sm text-dc-gray-500"
                          />
                          <button
                            type="button"
                            onClick={() => openWebsite(locatieLogoFactuur)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-600 disabled:opacity-40"
                            disabled={!locatieLogoFactuur.trim()}
                            title="Open URL"
                            aria-label="Open URL"
                          >
                            <Globe size={16} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {formError && (
              <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeBewerk}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-dc-gray-200 text-sm text-dc-gray-500 hover:bg-dc-gray-50"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={() => void handleBijwerken()}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-dc-blue-500 text-white text-sm font-medium hover:bg-dc-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />}
                {saving ? 'Bezig...' : 'Bijwerken'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
