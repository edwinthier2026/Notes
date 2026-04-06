import { FileText, Mail, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { fetchApi } from '../lib/api';
import { fetchNinoxInstellingenOverzicht, fetchNinoxMailContactpersonen, fetchNinoxMailTemplates, type NinoxInstellingItem } from '../lib/ninox';
import type { ContactpersoonMailOptie, MailTemplate } from '../types';
import MailtemplatesPage from './MailtemplatesPage';
import MailFormulier, { type MailFormulierConfig } from './ui/MailFormulier';

export default function MailenPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const activeTab = tab === 'mailtemplates' || tab === 'mail-verzenden' ? tab : 'mail-verzenden';
  const [mailTemplates, setMailTemplates] = useState<MailTemplate[]>([]);
  const [contactpersonen, setContactpersonen] = useState<ContactpersoonMailOptie[]>([]);
  const [instellingen, setInstellingen] = useState<NinoxInstellingItem | null>(null);
  const [selectedOntvangerId, setSelectedOntvangerId] = useState('');
  const [mailFormOpen, setMailFormOpen] = useState(true);
  const [mailFormVersion, setMailFormVersion] = useState(1);
  const [sending, setSending] = useState(false);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [mailError, setMailError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchNinoxMailTemplates();
        setMailTemplates(data);
        const contactpersonenData = await fetchNinoxMailContactpersonen();
        setContactpersonen(contactpersonenData);
        const instellingenData = await fetchNinoxInstellingenOverzicht();
        setInstellingen(instellingenData[0] || null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Mailtemplates laden mislukt.';
        setMailError(message);
      }
    })();
  }, []);

  const openTab = (nextTab: 'mail-verzenden' | 'mailtemplates') => {
    setSearchParams({ tab: nextTab });
    if (nextTab === 'mail-verzenden') {
      setMailFormOpen(true);
    }
  };

  useEffect(() => {
    if (activeTab === 'mail-verzenden') {
      setMailFormOpen(true);
    }
  }, [activeTab]);

  const mailVerzendenConfig = useMemo<MailFormulierConfig>(() => {
    const gebruikerNaam = user?.naam?.trim() || 'Planning';
    const gebruikerFunctie = user?.functie?.trim() || '';
    const selectedContactpersoon =
      contactpersonen.find((item) => String(item.id) === selectedOntvangerId) ||
      null;
    const instellingenFields = instellingen?.rawFields || {};
    const bedrijfsnaam =
      instellingen?.naam?.trim() ||
      String(instellingenFields['Naam vereniging'] || instellingenFields.Vereniging || '').trim();
    const logoMail =
      String(
        instellingenFields['Locatie logo mail'] ||
        instellingenFields['Logo mail locatie'] ||
        instellingenFields['Logo locatie mail'] ||
        instellingenFields['Logo mail'] ||
        instellingenFields['Logo URL mail'] ||
        ''
      ).trim();
    return {
      titel: 'Mail verzenden',
      actorKey: 'contactpersonen',
      draftKey: `contactpersonen-mail-verzenden-v2-${mailFormVersion}`,
      ontvangers: contactpersonen.map((item) => ({
        id: String(item.id),
        email: item.email,
        naam: item.naam,
        selected: String(item.id) === String(selectedContactpersoon?.id || ''),
        mergeFields: {
          Roepnaam: item.roepnaam || item.naam,
          Email: item.email,
          Gebruikersnaam: gebruikerNaam,
          Functie: gebruikerFunctie,
          Logo: logoMail,
          Bedrijfsnaam: bedrijfsnaam,
        },
      })),
      singleRecipientSelect: true,
      onSingleRecipientChange: setSelectedOntvangerId,
      showOntvangerSelectie: false,
      defaultOnderwerp: '',
      defaultInhoud: '',
      editorType: 'richtext',
      templates: mailTemplates,
      mergeFieldsPreview: {
        Roepnaam: selectedContactpersoon?.roepnaam || selectedContactpersoon?.naam || '{Roepnaam}',
        Email: selectedContactpersoon?.email || '{Email}',
        Gebruikersnaam: gebruikerNaam,
        Functie: gebruikerFunctie || '{Functie}',
        Logo: logoMail,
        Bedrijfsnaam: bedrijfsnaam,
      },
      hiddenMergeFields: [],
      onVerzenden: async (data) => {
        setSending(true);
        setMailError('');
        setProgressTotal(data.geselecteerdeOntvangers.length);
        setProgressCurrent(0);
        try {
          const response = await fetchApi('/azure-mail-send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              subjectTemplate: data.onderwerp,
              plainBodyTemplate: data.plainInhoud,
              htmlBodyTemplate: data.htmlPart,
              attachments: data.attachments,
              userContext: {
                Naam: user?.naam?.trim() || '',
                Gebruikersnaam: gebruikerNaam,
                gebruikersnaam: gebruikerNaam,
                Functie: gebruikerFunctie,
                Email: user?.email?.trim() || '',
                'E-mail': user?.email?.trim() || '',
                Logo: logoMail,
                Bedrijfsnaam: bedrijfsnaam,
              },
              ontvangers: data.geselecteerdeOntvangers.map((item) => ({
                email: item.email.trim(),
                naam: item.naam,
                mergeFields: {
                  ...(item.mergeFields || {}),
                  Gebruikersnaam: gebruikerNaam,
                  gebruikersnaam: gebruikerNaam,
                  Functie: gebruikerFunctie,
                },
              })),
            }),
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            const message = typeof payload?.message === 'string' ? payload.message : 'Azure mail verzenden mislukt.';
            throw new Error(message);
          }

          const sentCount = typeof payload?.sentCount === 'number' ? payload.sentCount : data.geselecteerdeOntvangers.length;
          setProgressCurrent(sentCount);
        } finally {
          setSending(false);
        }
      },
      onAfterSend: () => {
        setMailError('');
        setProgressCurrent(0);
        setProgressTotal(0);
        setSelectedOntvangerId('');
        setMailFormVersion((current) => current + 1);
        setMailFormOpen(true);
      },
      onCancel: () => {
        setMailError('');
        setProgressCurrent(0);
        setProgressTotal(0);
        setMailFormOpen(false);
      },
    };
  }, [contactpersonen, instellingen, mailFormVersion, mailTemplates, selectedOntvangerId, user?.email, user?.functie, user?.naam]);

  const tabButtonClass = (tabName: 'mail-verzenden' | 'mailtemplates') =>
    `w-full text-left rounded-lg border px-4 py-3 transition-colors ${
      activeTab === tabName
        ? 'border-dc-blue-500 bg-dc-blue-50'
        : 'border-dc-gray-100 hover:border-dc-blue-200 hover:bg-dc-blue-50/40'
    }`;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Mail size={24} className="text-dc-blue-500" />
          <h1 className="text-2xl font-semibold text-dc-gray-500">Mailen</h1>
        </div>
        <p className="text-sm text-dc-gray-400">Kies een onderdeel om te openen.</p>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-dc-gray-100 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <button type="button" onClick={() => openTab('mail-verzenden')} className={tabButtonClass('mail-verzenden')}>
              <div className="flex items-center gap-2">
                <Send size={18} className="text-dc-blue-500" />
                <span className="text-sm font-semibold text-dc-gray-500">Mail verzenden</span>
              </div>
            </button>
            <button type="button" onClick={() => openTab('mailtemplates')} className={tabButtonClass('mailtemplates')}>
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-dc-blue-500" />
                <span className="text-sm font-semibold text-dc-gray-500">Mailtemplates</span>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-dc-gray-100 p-5">
          {activeTab === 'mail-verzenden' && (
            <MailFormulier
              key={`mail-verzenden-${mailFormVersion}`}
              open={mailFormOpen}
              inline
              config={mailVerzendenConfig}
              sending={sending}
              progressCurrent={progressCurrent}
              progressTotal={progressTotal}
              error={mailError}
            />
          )}
          {activeTab === 'mailtemplates' && <MailtemplatesPage />}
        </div>
      </div>
    </div>
  );
}
