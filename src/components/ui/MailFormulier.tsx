import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';
import { Bold, Eraser, FileText, Italic, List, ListOrdered, Loader2, Underline, X } from 'lucide-react';
import { fetchNinoxMailTemplateDocument } from '../../lib/ninox';
import MailProgressBar from './MailProgressBar';
import ComboBox from './ComboBox';

const RICH_TEXT_COLOR_OPTIONS = ['#000000', '#C00000', '#0070C0', '#008000', '#7030A0', '#FF6600'];

export interface MailFormulierOntvanger {
  id: string;
  lidId?: number;
  email: string;
  naam: string;
  selected: boolean;
  mergeFields?: Record<string, string>;
}

export interface MailFormulierAttachmentInput {
  file: File;
}

export interface MailFormulierConfig {
  titel: string;
  actorKey: string;
  draftKey?: string;
  ontvangers: MailFormulierOntvanger[];
  singleRecipientSelect?: boolean;
  onSingleRecipientChange?: (id: string) => void;
  onOntvangerToggle?: (id: string) => void;
  onAllesSelecteren?: (selected: boolean) => void;
  showOntvangerSelectie?: boolean;
  ledenGroepen?: string[];
  geselecteerdeGroep?: string;
  onGroepSelectie?: (groep: string) => void;
  replyAdresOpties?: Array<{ value: string; label: string }>;
  defaultReplyAdres?: string;
  defaultOnderwerp?: string;
  defaultInhoud?: string;
  editorType: 'plain' | 'richtext';
  templates?: Array<{ id: number; titel: string; template: string; hasDocument?: boolean }>;
  mergeFieldsPreview: Record<string, string>;
  showMergeFieldButtons?: boolean;
  hiddenMergeFields?: string[];
  pdfConfig?: {
    allowUpload?: boolean;
    maxFiles?: number;
    label?: string;
    initialAttachments?: MailFormulierAttachmentInput[];
  };
  onVerzenden: (data: {
    onderwerp: string;
    plainInhoud: string;
    htmlPart: string;
    geselecteerdeOntvangers: MailFormulierOntvanger[];
    attachments: Array<{ filename: string; contentType: string; base64Content: string }>;
    replyAdres?: string;
  }) => Promise<void>;
  onPreview?: () => Promise<void>;
  onAfterSend?: () => void;
  onCancel: () => void;
  modalWidth?: string;
  enforceActieveLeden?: boolean;
  previewButtonLabel?: string;
}

interface MailFormulierProps {
  open: boolean;
  config: MailFormulierConfig;
  sending: boolean;
  progressCurrent: number;
  progressTotal: number;
  error: string;
  inline?: boolean;
}

type MailFormulierDraft = {
  onderwerp: string;
  inhoud: string;
  replyAdres: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function toPlainTextFromHtml(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toHtmlPartFromEditor(html: string): string {
  return String(html || '')
    .replace(/<\/div>\s*<div/gi, '<br><div')
    .replace(/<\/div>/gi, '<br>')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/p>/gi, '<br>')
    .replace(/<p[^>]*>/gi, '')
    .replace(/(<br\s*\/?>\s*){2,}/gi, '<br><br>');
}

function loadMailDraft(draftKey?: string): MailFormulierDraft | null {
  if (!draftKey || typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(`mail-form:${draftKey}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<MailFormulierDraft>;
    return {
      onderwerp: String(parsed.onderwerp || ''),
      inhoud: String(parsed.inhoud || ''),
      replyAdres: String(parsed.replyAdres || ''),
    };
  } catch {
    return null;
  }
}

function saveMailDraft(draftKey: string | undefined, draft: MailFormulierDraft) {
  if (!draftKey || typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(`mail-form:${draftKey}`, JSON.stringify(draft));
  } catch {
    // Stil falen: tijdelijk bewaren is handig, maar mag de mailflow niet blokkeren.
  }
}

function clearMailDraft(draftKey?: string) {
  if (!draftKey || typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.removeItem(`mail-form:${draftKey}`);
  } catch {
    // Geen blokkade opruimen.
  }
}

function isLegacyEmptyMailenDraft(draftKey: string | undefined, inhoud: string, defaultInhoud: string): boolean {
  if (!draftKey || defaultInhoud.trim()) {
    return false;
  }
  if (!draftKey.startsWith('contactpersonen-mail-verzenden')) {
    return false;
  }
  const plainText = toPlainTextFromHtml(String(inhoud || ''))
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  const legacyText = [
    'Beste Edwin,',
    '',
    'Via deze mail stuur ik jullie dit bericht.',
    '',
    'Met vriendelijke groet,',
    'Edwin Thier',
    '',
    '{Bedrijfsnaam}',
    '{Logo}',
  ].join('\n');
  return plainText === legacyText;
}

export default function MailFormulier({
  open,
  config,
  sending,
  progressCurrent,
  progressTotal,
  error,
  inline = false,
}: MailFormulierProps) {
  const [onderwerp, setOnderwerp] = useState('');
  const [inhoud, setInhoud] = useState('');
  const [replyAdres, setReplyAdres] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [memoExpanded, setMemoExpanded] = useState(false);
  const [bijlageBestand1, setBijlageBestand1] = useState<File | null>(null);
  const [bijlageBestand2, setBijlageBestand2] = useState<File | null>(null);
  const [localError, setLocalError] = useState('');
  const inhoudRef = useRef<HTMLDivElement | HTMLTextAreaElement>(null);
  const bijlageInputRef1 = useRef<HTMLInputElement>(null);
  const bijlageInputRef2 = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const initialInhoud = config.defaultInhoud || '';
    const initialAttachments = config.pdfConfig?.initialAttachments || [];
    const rawStoredDraft = loadMailDraft(config.draftKey);
    const storedDraft =
      rawStoredDraft && !isLegacyEmptyMailenDraft(config.draftKey, rawStoredDraft.inhoud, initialInhoud)
        ? rawStoredDraft
        : null;
    const fallbackInhoud = config.editorType === 'richtext' ? initialInhoud.replace(/\n/g, '<br>') : initialInhoud;
    setOnderwerp(storedDraft?.onderwerp || config.defaultOnderwerp || '');
    setInhoud(storedDraft?.inhoud || fallbackInhoud);
    setReplyAdres(storedDraft?.replyAdres || config.defaultReplyAdres || '');
    setTemplateId('');
    setMemoExpanded(false);
    setLocalError('');
    setBijlageBestand1(initialAttachments[0]?.file || null);
    setBijlageBestand2(initialAttachments[1]?.file || null);
  }, [open, config]);

  useEffect(() => {
    if (!open) {
      return;
    }
    saveMailDraft(config.draftKey, {
      onderwerp,
      inhoud,
      replyAdres,
    });
  }, [config.draftKey, inhoud, onderwerp, open, replyAdres]);

  useEffect(() => {
    if (config.editorType !== 'richtext' || !inhoudRef.current) {
      return;
    }
    const div = inhoudRef.current as HTMLDivElement;
    if (div.innerHTML !== inhoud) {
      div.innerHTML = inhoud;
    }
  }, [inhoud, config.editorType]);

  const syncEditorHtml = () => {
    if (config.editorType === 'richtext' && inhoudRef.current) {
      setInhoud((inhoudRef.current as HTMLDivElement).innerHTML || '');
    }
  };

  const execEditorCommand = (command: string, value?: string) => {
    if (config.editorType !== 'richtext' || !inhoudRef.current) {
      return;
    }
    (inhoudRef.current as HTMLDivElement).focus();
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

  const insertMergeField = (fieldName: string) => {
    if (!inhoudRef.current) {
      return;
    }

    if (config.editorType === 'richtext') {
      (inhoudRef.current as HTMLDivElement).focus();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(`{${fieldName}}`);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      syncEditorHtml();
      return;
    }

    const textarea = inhoudRef.current as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const newValue = `${text.substring(0, start)}{${fieldName}}${text.substring(end)}`;
    setInhoud(newValue);
    setTimeout(() => {
      textarea.focus();
      const nextPos = start + fieldName.length + 2;
      textarea.setSelectionRange(nextPos, nextPos);
    }, 0);
  };

  const handleTemplateChange = (value: string) => {
    setTemplateId(value);
    if (!value || !config.templates) {
      return;
    }

    const template = config.templates.find((item) => String(item.id) === value);
    if (!template) {
      return;
    }

    if (!onderwerp.trim() && template.titel) {
      setOnderwerp(template.titel);
    }

    const plainText = toPlainTextFromHtml(template.template);
    setInhoud(config.editorType === 'richtext' ? plainText.replace(/\n/g, '<br>') : plainText);

    if (!template.hasDocument) {
      return;
    }

    void (async () => {
      try {
        const document = await fetchNinoxMailTemplateDocument(template.id);
        if (!document?.blob) {
          return;
        }
        const file = new File([document.blob], document.naam || 'template.pdf', { type: 'application/pdf' });
        if (!bijlageBestand1) {
          setBijlageBestand1(file);
        } else if (!bijlageBestand2) {
          setBijlageBestand2(file);
        } else {
          setBijlageBestand1(file);
        }
      } catch (templateError) {
        console.error('Fout bij laden template-PDF:', templateError);
      }
    })();
  };

  const handleBijlageChange = (slot: 1 | 2) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setLocalError('Alleen PDF-bestanden zijn toegestaan.');
      event.target.value = '';
      return;
    }
    setLocalError('');
    if (slot === 1) {
      setBijlageBestand1(file);
    } else {
      setBijlageBestand2(file);
    }
    event.target.value = '';
  };

  const handleVerwijderBijlage = (slot: 1 | 2) => () => {
    if (slot === 1) {
      setBijlageBestand1(null);
      if (bijlageInputRef1.current) {
        bijlageInputRef1.current.value = '';
      }
      return;
    }
    setBijlageBestand2(null);
    if (bijlageInputRef2.current) {
      bijlageInputRef2.current.value = '';
    }
  };

  const handleVerzenden = async () => {
    const geselecteerdeOntvangers = config.ontvangers.filter((item) => item.selected);
    if (geselecteerdeOntvangers.length === 0) {
      setLocalError('Selecteer minimaal 1 ontvanger.');
      return;
    }
    if (!onderwerp.trim()) {
      setLocalError('Onderwerp is verplicht.');
      return;
    }

    setLocalError('');
    try {
      const attachments: Array<{ filename: string; contentType: string; base64Content: string }> = [];
      const attachmentFiles = [bijlageBestand1, bijlageBestand2].filter(Boolean) as File[];
      for (const file of attachmentFiles) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        attachments.push({
          filename: file.name,
          contentType: file.type || 'application/pdf',
          base64Content: bytesToBase64(bytes),
        });
      }

      await config.onVerzenden({
        onderwerp: onderwerp.trim(),
        plainInhoud: config.editorType === 'richtext' ? toPlainTextFromHtml(inhoud) : inhoud,
        htmlPart: config.editorType === 'richtext' ? toHtmlPartFromEditor(inhoud) : '',
        geselecteerdeOntvangers,
        attachments,
        replyAdres: replyAdres || undefined,
      });
      clearMailDraft(config.draftKey);
      if (config.onAfterSend) {
        config.onAfterSend();
      } else {
        config.onCancel();
      }
    } catch (sendError) {
      setLocalError(sendError instanceof Error ? sendError.message : 'Verzenden mislukt.');
    }
  };

  if (!open) {
    return null;
  }

  const modalWidth = config.modalWidth || '768px';
  const showOntvangerSelectie = config.showOntvangerSelectie !== false;
  const showMergeFieldButtons = config.showMergeFieldButtons !== false;
  const pdfConfig = config.pdfConfig || { allowUpload: true, maxFiles: 2, label: 'PDF bijlage (optioneel)' };
  const maxFiles = pdfConfig.maxFiles || 2;
  const hiddenFields = new Set(config.hiddenMergeFields || []);
  const visibleMergeFields = Object.keys(config.mergeFieldsPreview).filter((field) => !hiddenFields.has(field));
  const algemeneMergeFields = new Set(['Gebruikersnaam', 'Functie', 'Logo', 'Bedrijfsnaam']);
  const allesGeselecteerd = config.ontvangers.length > 0 && config.ontvangers.every((item) => item.selected);
  const geselecteerdeOntvangers = config.ontvangers.filter((item) => item.selected);
  const combinedError = localError || error;
  const hasReplyAdres = (config.replyAdresOpties && config.replyAdresOpties.length > 0) || replyAdres.trim();

  const formulierBody = (
    <div
      className={`${inline ? 'w-full rounded-xl border border-dc-gray-100 bg-white p-6' : 'max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-auto rounded-xl border border-dc-gray-100 bg-white p-6'}`}
      style={inline ? undefined : { width: modalWidth, minWidth: modalWidth }}
    >
        {!inline ? <h2 className="mb-1 text-lg font-semibold text-dc-gray-500">{config.titel}</h2> : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-6">
            <label className="mb-1 block text-xs font-medium text-dc-gray-400">Onderwerp</label>
            <input
              value={onderwerp}
              onChange={(event) => setOnderwerp(event.target.value)}
              placeholder="Onderwerp"
              className="w-full rounded-lg border border-dc-gray-200 px-3 py-2 text-sm outline-none focus:border-dc-blue-500"
              disabled={sending}
            />
          </div>

          {hasReplyAdres ? (
            <div className="md:col-span-6">
              <label className="mb-1 block text-xs font-medium text-dc-gray-400">Reply adres</label>
              <ComboBox
                value={replyAdres}
                onChange={(value) => setReplyAdres(value)}
                options={config.replyAdresOpties || []}
                placeholder="Standaard afzender"
                disabled={sending}
              />
            </div>
          ) : null}

          {!showOntvangerSelectie && (config.singleRecipientSelect || geselecteerdeOntvangers.length > 0) ? (
            <div className="md:col-span-6">
              <label className="mb-1 block text-xs font-medium text-dc-gray-400">Aan</label>
              {config.singleRecipientSelect ? (
                <ComboBox
                  value={geselecteerdeOntvangers[0]?.id || ''}
                  onChange={(value) => config.onSingleRecipientChange?.(value)}
                  options={config.ontvangers.map((ontvanger) => ({
                    value: ontvanger.id,
                    label: `${ontvanger.naam} - ${ontvanger.email}`,
                    subtitle: ontvanger.email,
                    searchText: `${ontvanger.naam} ${ontvanger.email}`,
                  }))}
                  placeholder="Kies contactpersoon..."
                  disabled={sending}
                />
              ) : (
                <div className="rounded-lg border border-dc-gray-200 bg-dc-gray-50 px-3 py-2 text-sm text-dc-gray-500">
                  {geselecteerdeOntvangers.map((ontvanger) => `${ontvanger.naam} (${ontvanger.email})`).join(', ')}
                </div>
              )}
            </div>
          ) : null}

          {config.templates && config.templates.length > 0 ? (
            <div className="md:col-span-6">
              <label className="mb-1 block text-xs font-medium text-dc-gray-400">Kies template</label>
              <ComboBox
                value={templateId}
                onChange={handleTemplateChange}
                options={[
                  { value: '', label: '-- Kies een template --' },
                  ...config.templates.map((template) => ({
                    value: String(template.id),
                    label: template.titel,
                  })),
                ]}
                placeholder="Kies template..."
                disabled={sending}
              />
            </div>
          ) : null}

          <div className="md:col-span-6">
            <label className="mb-1 block text-xs font-medium text-dc-gray-400">Berichtinhoud</label>

            {config.editorType === 'richtext' ? (
              <div className="mb-2 flex flex-wrap items-center gap-1">
                <button type="button" onMouseDown={keepSelection} onClick={() => execEditorCommand('bold')} className="rounded border border-dc-gray-200 px-2 py-1 text-dc-gray-500 hover:bg-dc-gray-50"><Bold size={14} /></button>
                <button type="button" onMouseDown={keepSelection} onClick={() => execEditorCommand('italic')} className="rounded border border-dc-gray-200 px-2 py-1 text-dc-gray-500 hover:bg-dc-gray-50"><Italic size={14} /></button>
                <button type="button" onMouseDown={keepSelection} onClick={() => execEditorCommand('underline')} className="rounded border border-dc-gray-200 px-2 py-1 text-dc-gray-500 hover:bg-dc-gray-50"><Underline size={14} /></button>
                <button type="button" onMouseDown={keepSelection} onClick={() => execEditorCommand('insertUnorderedList')} className="rounded border border-dc-gray-200 px-2 py-1 text-dc-gray-500 hover:bg-dc-gray-50"><List size={14} /></button>
                <button type="button" onMouseDown={keepSelection} onClick={() => execEditorCommand('insertOrderedList')} className="rounded border border-dc-gray-200 px-2 py-1 text-dc-gray-500 hover:bg-dc-gray-50"><ListOrdered size={14} /></button>
                <button type="button" onMouseDown={keepSelection} onClick={() => execEditorCommand('removeFormat')} className="rounded border border-dc-gray-200 px-2 py-1 text-dc-gray-500 hover:bg-dc-gray-50"><Eraser size={14} /></button>
                <div className="mx-1 h-5 w-px bg-dc-gray-200" />
                {RICH_TEXT_COLOR_OPTIONS.map((color) => (
                  <button
                    key={`rt-color-${color}`}
                    type="button"
                    onMouseDown={keepSelection}
                    onClick={() => applyTextColor(color)}
                    className="h-6 w-6 rounded border border-dc-gray-200 hover:opacity-90"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            ) : null}

            {showMergeFieldButtons && visibleMergeFields.length > 0 ? (
              <div className="mb-3 text-xs text-dc-gray-400">
                <div className="mb-1 font-medium">{`Beschikbare koppelvelden: ${config.actorKey}`}</div>
                <div className="flex flex-wrap gap-1">
                  {visibleMergeFields.map((field) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => insertMergeField(field)}
                      className={`rounded border px-2 py-0.5 font-mono text-[10px] hover:bg-dc-gray-100 ${
                        algemeneMergeFields.has(field)
                          ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                      disabled={sending}
                    >
                      {`{${field}}`}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="relative">
              {config.editorType === 'richtext' ? (
                <div
                  ref={inhoudRef as RefObject<HTMLDivElement>}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={syncEditorHtml}
                  className={`dc-richtext-content dc-mail-richtext w-full resize overflow-y-auto rounded-lg border border-dc-gray-200 px-3 py-2 pr-10 text-sm outline-none focus:border-dc-blue-500 ${
                    memoExpanded ? 'h-[30rem]' : 'h-[15rem]'
                  }`}
                  style={{ color: '#000000' }}
                />
              ) : (
                <textarea
                  ref={inhoudRef as RefObject<HTMLTextAreaElement>}
                  value={inhoud}
                  onChange={(event) => setInhoud(event.target.value)}
                  className={`w-full resize-none rounded-lg border border-dc-gray-200 px-3 py-2 pr-10 text-sm outline-none focus:border-dc-blue-500 ${
                    memoExpanded ? 'h-[30rem]' : 'h-[15rem]'
                  }`}
                  disabled={sending}
                />
              )}
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

          {pdfConfig.allowUpload !== false ? (
            <div className="md:col-span-6">
              <label className="mb-1 block text-xs font-medium text-dc-gray-400">{pdfConfig.label || 'PDF bijlage (optioneel)'}</label>
              <div className="mb-2">
                <input
                  ref={bijlageInputRef1}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleBijlageChange(1)}
                  className="hidden"
                  disabled={sending}
                />
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => bijlageInputRef1.current?.click()} className="rounded-lg border border-dc-gray-200 px-3 py-2 text-sm hover:bg-dc-gray-50" disabled={sending}>
                    Kies bijlage 1
                  </button>
                  {bijlageBestand1 ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-dc-gray-500">{bijlageBestand1.name}</span>
                      <button type="button" onClick={handleVerwijderBijlage(1)} className="text-red-600 hover:text-red-700" disabled={sending}>
                        <X size={16} />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {maxFiles >= 2 ? (
                <div>
                  <input
                    ref={bijlageInputRef2}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleBijlageChange(2)}
                    className="hidden"
                    disabled={sending}
                  />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => bijlageInputRef2.current?.click()} className="rounded-lg border border-dc-gray-200 px-3 py-2 text-sm hover:bg-dc-gray-50" disabled={sending}>
                      Kies bijlage 2
                    </button>
                    {bijlageBestand2 ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-dc-gray-500">{bijlageBestand2.name}</span>
                        <button type="button" onClick={handleVerwijderBijlage(2)} className="text-red-600 hover:text-red-700" disabled={sending}>
                          <X size={16} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {showOntvangerSelectie && config.ontvangers.length > 0 ? (
            <div className="md:col-span-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-xs font-medium text-dc-gray-400">
                      Ontvangers ({config.ontvangers.filter((item) => item.selected).length} geselecteerd)
                    </label>
                    {config.onAllesSelecteren ? (
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-dc-gray-500">
                        <input
                          type="checkbox"
                          checked={allesGeselecteerd}
                          onChange={(event) => config.onAllesSelecteren?.(event.target.checked)}
                          disabled={sending || Boolean(config.geselecteerdeGroep)}
                        />
                        Alles selecteren
                      </label>
                    ) : null}
                  </div>
                  <div className="max-h-[200px] overflow-y-auto rounded-lg border border-dc-gray-200 p-2">
                    {config.ontvangers.map((ontvanger) => (
                      <label
                        key={ontvanger.id}
                        className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-dc-gray-50 ${config.geselecteerdeGroep ? 'opacity-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={ontvanger.selected}
                          onChange={() => config.onOntvangerToggle?.(ontvanger.id)}
                          disabled={sending || Boolean(config.geselecteerdeGroep)}
                        />
                        <span className="text-sm">{ontvanger.naam}</span>
                        <span className="text-xs text-dc-gray-400">({ontvanger.email})</span>
                      </label>
                    ))}
                  </div>
                </div>

                {config.ledenGroepen && config.ledenGroepen.length > 0 ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-dc-gray-400">Ledengroepen (kies 1 groep)</label>
                    <div className="max-h-[200px] overflow-y-auto rounded-lg border border-dc-gray-200 p-2">
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-dc-gray-50">
                        <input
                          type="radio"
                          name={`ledengroep-${config.actorKey}`}
                          checked={!config.geselecteerdeGroep}
                          onChange={() => config.onGroepSelectie?.('')}
                          disabled={sending}
                        />
                        <span className="text-sm italic text-dc-gray-400">Geen groep (gebruik ontvangerselectie)</span>
                      </label>
                      {config.ledenGroepen.map((groep) => (
                        <label key={groep} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-dc-gray-50">
                          <input
                            type="radio"
                            name={`ledengroep-${config.actorKey}`}
                            checked={config.geselecteerdeGroep === groep}
                            onChange={() => config.onGroepSelectie?.(groep)}
                            disabled={sending}
                          />
                          <span className="text-sm">{groep}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {combinedError ? (
            <div className="md:col-span-6">
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{combinedError}</div>
            </div>
          ) : null}

          <div className="md:col-span-6">
            <MailProgressBar active={sending} current={progressCurrent} total={progressTotal} />
          </div>

          {config.enforceActieveLeden ? (
            <div className="md:col-span-6">
              <p className="text-xs italic text-dc-gray-400">* Alleen actieve leden ontvangen deze mail</p>
            </div>
          ) : null}

          <div className="md:col-span-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={config.onCancel}
              className="rounded-lg border border-dc-gray-200 px-4 py-2 text-sm hover:bg-dc-gray-50"
              disabled={sending}
            >
              Annuleren
            </button>
            {config.onPreview ? (
              <button
                type="button"
                onClick={() => void config.onPreview?.()}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={sending}
              >
                {config.previewButtonLabel || 'Preview PDF'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleVerzenden()}
              disabled={sending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="inline w-4 h-4 mr-2 animate-spin" /> : null}
              {sending ? 'Bezig...' : 'Verzenden'}
            </button>
          </div>
        </div>
      </div>
  );

  if (inline) {
    return formulierBody;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      {formulierBody}
    </div>
  );
}
