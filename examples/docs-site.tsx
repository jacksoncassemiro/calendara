import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CodeBlock } from './components/CodeBlock';
import apiModel from './generated/api-model.json';
import { demos } from './demos/catalog';
import './docs-site.css';
import { SiteHeader, type SiteLanguage, type SiteTheme } from './components/SiteHeader';

const repository = 'https://github.com/jacksoncassemiro/calendara';
const installCommand =
  'yarn add https://github.com/jacksoncassemiro/calendara/releases/download/v0.4.2/calendara-0.4.2.tgz';
const firstCalendar = `import { Calendar, dayView, monthView } from '@jacksoncassemiro/calendara';
import '@jacksoncassemiro/calendara/styles.css';

const views = [dayView, monthView];

export function Agenda() {
  return <Calendar
    views={views}
    events={[]}
    initialView="day"
    options={{ timeZone: 'America/Sao_Paulo' }}
  />;
}`;

const content = {
  'pt-BR': {
    theme: 'Tema',
    themeOptions: ['Sistema', 'Claro', 'Escuro'],
    catalog: 'Explorar recursos',
    catalogIntro:
      'Encontre a view ou o comportamento que sua agenda precisa. Cada recurso mostra um exemplo e seu escopo de integração.',
    featureSearch: 'Buscar recurso',
    allFeatures: 'Todos os recursos',
    featureEmpty: 'Nenhum recurso encontrado. Tente outro termo ou categoria.',
    implemented: 'Disponível no pacote',
    featureScope: 'Escopo',
    tryFeature: 'Abrir demonstração',
    bundle: 'Tamanho e organização do pacote',
    bundleNote:
      'Mês + dia: 72,9 kB gzip no ensaio de produção, excluindo React e CSS e incluindo todos os chunks. FullCalendar: 70,6 kB; Schedule-X: 68,7 kB; Mantine: 85,1 kB; React Big Calendar: 54,9 kB. Os recursos e runtimes não são equivalentes. Mantemos um pacote: separar instalações não elimina o custo compartilhado de recorrência e datas.',
    bundleLink: 'Metodologia, versões e resultados reproduzíveis',
    distribution: 'Distribuição no GitHub',
    distributionNote:
      'A versão experimental 0.4.2 está publicada com .tgz e checksum. Instale pela URL fixa da release; o site e o pacote têm publicações separadas. A instalação pelos assets públicos não exige autenticação no registro npm do GitHub.',
    distributionLink: 'Como preparar e instalar uma release',
    title: 'Uma agenda que se adapta ao seu trabalho.',
    introduction:
      'Calendário React com recorrência, salas e views configuráveis. Escolha o que mostrar; mantenha os dados e as decisões no seu aplicativo.',
    experimental:
      'Projeto pessoal e experimental desenvolvido com assistência do OpenAI Codex. As APIs podem mudar antes da versão 1.0; valide os cenários do seu aplicativo.',
    demo: 'Experimentar a agenda',
    source: 'Código no GitHub',
    start: 'Primeiros passos',
    topics: 'Guias de integração',
    reference: 'Referência da API',
    limits: 'Recursos e limites',
    subtitle: 'Documentação e demonstração',
    skip: 'Ir para o conteúdo',
    language: 'Idioma',
    version: '0.4.2 · MIT',
    install: 'Instale uma versão publicada',
    installNote:
      'Copie a URL do arquivo .tgz de uma GitHub Release publicada. Use a URL fixa da versão desejada, como no comando abaixo.',
    peer: 'React e React DOM 18 ou 19 são peers. Use versões compatíveis. Importar o CSS é necessário para o tema padrão; Tailwind não é exigido.',
    release: 'Ver releases',
    render: 'Escolha as views e renderize',
    exampleNote:
      'views é obrigatória e define o conjunto completo. Use BUILTIN_VIEWS como atalho ou importe somente as views desejadas. initialView configura a montagem; a primeira view é o padrão.',
    apiIntro:
      'Campos gerados diretamente dos contratos TypeScript e de seu JSDoc. Os guias explicam os fluxos; os tipos abaixo descrevem propriedades e métodos.',
    search: 'Buscar campo ou descrição',
    contract: 'Contrato',
    required: 'Obrigatório',
    optional: 'Opcional',
    method: 'Método',
    noResults: 'Nenhum campo corresponde à busca.',
    noDescription: 'Consulte o contrato no código-fonte.',
    fullGuide: 'Ler guia completo',
    sourceField: 'Ver declaração',
    limitsIntro:
      'Use a demonstração para conferir o comportamento e as notas da versão para decidir a adoção. Ainda não há paridade completa com todas as bibliotecas de agenda.',
    limitsList: [
      'Recorrência de segundos até anos, com filtros e exceções; há limites explícitos de expansão.',
      'Recursos, editor, impressão, histórico local e intercâmbio ICS são MIT. A virtualização cobre linhas da timeline. A direção RTL é configurável; componentes próprios devem respeitá-la.',
      'O editor oferece EN/PT e aceita messages para traduções próprias; locale formata meses e dias.',
      'Testes automatizados usam Edge/Chrome. Safari, toque físico e leitores de tela precisam de validação específica.',
      'Validação cliente não substitui autorização nem reserva transacional no servidor.',
    ],
    comparison: 'Comparar alternativas',
    security: 'Política de segurança',
    contributing: 'Como contribuir',
    preview: 'Exemplo de organização semanal',
    days: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
    meeting: 'Consulta',
    collection: 'Coleta',
    review: 'Retorno',
    topicsList: [
      {
        id: 'persistence',
        title: 'Salvar movimentos e edições',
        text: 'Escolha events em estado React ou eventSource como fonte de verdade. O gesto é otimista: retornar false ou rejeitar a Promise reverte. A biblioteca não grava no servidor.',
        code: `async function commit(change: EventChange) {\n  await persistChange(change);\n  setEvents(current => applyEventTimeChange({ events: current, change }));\n}\n\n<Calendar views={views} events={events}\n  onEventDrop={commit} onEventResize={commit} />;`,
        note: 'Importe EventChange e applyEventTimeChange do pacote. persistChange e setEvents pertencem ao aplicativo.',
      },
      {
        id: 'resources',
        title: 'Salas, capacidade e disponibilidade',
        text: 'Capacidade global serve como default; cada sala pode substituir ou escolher false para ilimitado. Regras locais se somam às globais. resourceIds atribui todos os recursos ocupados pelo evento.',
        code: `<Calendar resources={[\n  { id: 'triagem', title: 'Triagem', capacity: 4 },\n  { id: 'consulta', title: 'Consulta', capacity: 1 },\n  { id: 'coleta', title: 'Coleta', capacity: false },\n]} options={{ defaultResourceCapacity: 2 }}\n  views={[createResourceDayView(), createTimelineView()]} />;`,
        note: 'Capacidade e buffers são avaliados nos gestos e em evaluateEvent. Confirme concorrência no servidor antes de persistir.',
      },
      {
        id: 'editor',
        title: 'Seu formulário, seu conteúdo',
        text: 'O editor é opcional e independente. Abra modal, painel ou rota através dos callbacks. evaluateEvent valida seu candidato sem salvar. renderEvent troca conteúdo dentro do cartão.',
        code: `<Calendar views={views}\n  onEventClick={openEditor}\n  onDateSelect={openCreateForm}\n  renderEvent={info => <MeuEvento {...info} />}\n/>;\n\nconst result = api.evaluateEvent(draft, originalOccurrence);`,
        note: 'Hooks ficam no componente MeuEvento, não diretamente no callback. Ao editar, informe a ocorrência original para excluir sua própria ocupação.',
      },
      {
        id: 'time-axis',
        title: 'Escala, slots e rótulos independentes',
        text: 'slotMinutes define células e snapping. pxPerMinute define escala. timeLabelInterval controla somente os textos; o intervalo explícito não muda ao trocar a escala.',
        code: `<Calendar views={views} options={{\n  slotMinutes: 30,\n  pxPerMinute: 2,\n  timeLabelInterval: 60,\n  timedEventOverflow: 'more',\n  eventMaxStack: 3,\n}} />;`,
        note: 'Neste exemplo, slots ocupam 60 px; rótulos aparecem a cada 120 px. Sem intervalo explícito, o modo automático adapta os textos.',
      },
      {
        id: 'recurrence',
        title: 'Recorrência e exceções',
        text: 'Regras são parte do evento. rDates adiciona datas; exDates remove; overrides usa o início original da ocorrência. Esta-e-seguintes divide o mestre para preservar o histórico.',
        code: `recurrence: {\n  rule: { freq: 'WEEKLY', byDay: [{ weekday: 'MO' }], count: 12 },\n  exDates: ['2026-10-12T09:00:00'],\n}`,
        note: 'A composição usa recorrência civil e Temporal/fallback. Validar um evento não verifica automaticamente todas as repetições futuras.',
      },
    ],
  },
  en: {
    theme: 'Theme',
    themeOptions: ['System', 'Light', 'Dark'],
    catalog: 'Explore features',
    catalogIntro:
      'Find the view or behavior your schedule needs. Every feature includes an example and its integration scope.',
    featureSearch: 'Search features',
    allFeatures: 'All features',
    featureEmpty: 'No features found. Try another term or category.',
    implemented: 'Available in the package',
    featureScope: 'Scope',
    tryFeature: 'Open demonstration',
    bundle: 'Bundle size and package structure',
    bundleNote:
      'Month + Day: 72.9 kB gzip in the production fixture, excluding React and CSS and including every chunk. FullCalendar: 70.6 kB; Schedule-X: 68.7 kB; Mantine: 85.1 kB; React Big Calendar: 54.9 kB. Features and runtimes differ. We retain one package: separate installations do not remove shared recurrence and date costs.',
    bundleLink: 'Methodology, versions and reproducible results',
    distribution: 'GitHub distribution',
    distributionNote:
      'Experimental version 0.4.2 is published with a .tgz and checksum. Install using the fixed release URL; the site and package are published separately. Installing public release assets does not require GitHub npm registry authentication.',
    distributionLink: 'Preparing and installing a release',
    title: 'A schedule that fits the way you work.',
    introduction:
      'A React calendar with recurrence, rooms and configurable views. Choose what to display; keep data and business decisions in your application.',
    experimental:
      'A personal, experimental project developed with assistance from OpenAI Codex. APIs may change before 1.0; test the scenarios your application depends on.',
    demo: 'Try the calendar',
    source: 'Source on GitHub',
    start: 'Getting started',
    topics: 'Integration guides',
    reference: 'API reference',
    limits: 'Features and limits',
    subtitle: 'Documentation and demo',
    skip: 'Skip to content',
    language: 'Language',
    version: '0.4.2 · MIT',
    install: 'Install a published version',
    installNote:
      'Copy the .tgz asset URL from a published GitHub Release. Use the fixed URL of the desired version, as in the command below.',
    peer: 'React and React DOM 18 or 19 are peers. Use matching versions. Import CSS for the default theme; Tailwind is not required.',
    release: 'Browse releases',
    render: 'Choose views and render',
    exampleNote:
      'views is required and defines the complete set. Use BUILTIN_VIEWS as a shortcut or import only selected views. initialView configures mount; the first view is the default.',
    apiIntro:
      'Fields generated directly from TypeScript contracts and their JSDoc. Guides explain workflows; the types below describe properties and methods.',
    search: 'Search fields or descriptions',
    contract: 'Contract',
    required: 'Required',
    optional: 'Optional',
    method: 'Method',
    noResults: 'No fields match your search.',
    noDescription: 'Read the contract in the source code.',
    fullGuide: 'Read the full guide',
    sourceField: 'View declaration',
    limitsIntro:
      'Use the demo to check behavior and the release notes to decide adoption. Complete parity with every scheduling library is not claimed.',
    limitsList: [
      'Secondly through yearly recurrence, with filters and exceptions; expansion has explicit limits.',
      'Resource views, editor, printing, local history and ICS interchange are MIT. Virtualization covers timeline rows. RTL direction is configurable; custom components must respect it.',
      'The editor includes EN/PT and accepts messages for custom translations; locale formats months and weekdays.',
      'Automated tests use Edge/Chrome. Safari, physical touch and screen readers require separate validation.',
      'Client validation does not replace server authorization or transactional reservations.',
    ],
    comparison: 'Compare alternatives',
    security: 'Security policy',
    contributing: 'Contributing',
    preview: 'Example weekly organization',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    meeting: 'Consultation',
    collection: 'Collection',
    review: 'Follow-up',
    topicsList: [
      {
        id: 'persistence',
        title: 'Save moves and edits',
        text: 'Choose React events state or eventSource as the authority. Gestures are optimistic: false or a rejected promise reverts. The library does not persist on a server.',
        code: `async function commit(change: EventChange) {\n  await persistChange(change);\n  setEvents(current => applyEventTimeChange({ events: current, change }));\n}\n\n<Calendar views={views} events={events}\n  onEventDrop={commit} onEventResize={commit} />;`,
        note: 'Import EventChange and applyEventTimeChange from the package. persistChange and setEvents belong to your application.',
      },
      {
        id: 'resources',
        title: 'Rooms, capacity and availability',
        text: 'Global capacity is a default; each room can override it or use false for unlimited. Local rules retain global restrictions. resourceIds assigns every resource occupied by an event.',
        code: `<Calendar resources={[\n  { id: 'triage', title: 'Triage', capacity: 4 },\n  { id: 'consultation', title: 'Consultation', capacity: 1 },\n  { id: 'collection', title: 'Collection', capacity: false },\n]} options={{ defaultResourceCapacity: 2 }}\n  views={[createResourceDayView(), createTimelineView()]} />;`,
        note: 'Capacity and buffers are evaluated in gestures and evaluateEvent. Check concurrency on the server before persisting.',
      },
      {
        id: 'editor',
        title: 'Your form, your content',
        text: 'The editor is optional and independent. Open your modal, panel or route through callbacks. evaluateEvent validates without saving. renderEvent replaces card content.',
        code: `<Calendar views={views}\n  onEventClick={openEditor}\n  onDateSelect={openCreateForm}\n  renderEvent={info => <YourEvent {...info} />}\n/>;\n\nconst result = api.evaluateEvent(draft, originalOccurrence);`,
        note: 'Hooks belong inside YourEvent, not directly in the callback. Pass the original occurrence on edits to exclude its reservation.',
      },
      {
        id: 'time-axis',
        title: 'Separate scale, slots and labels',
        text: 'slotMinutes defines cells and snapping. pxPerMinute defines scale. timeLabelInterval only controls text; an explicit interval stays fixed when scale changes.',
        code: `<Calendar views={views} options={{\n  slotMinutes: 30,\n  pxPerMinute: 2,\n  timeLabelInterval: 60,\n  timedEventOverflow: 'more',\n  eventMaxStack: 3,\n}} />;`,
        note: 'Here slots occupy 60 px and labels appear every 120 px. Without an explicit interval, automatic mode adapts the labels.',
      },
      {
        id: 'recurrence',
        title: 'Recurrence and exceptions',
        text: 'Rules belong to the event. rDates adds starts; exDates removes them; overrides uses the original occurrence start. This-and-following splits the master to preserve history.',
        code: `recurrence: {\n  rule: { freq: 'WEEKLY', byDay: [{ weekday: 'MO' }], count: 12 },\n  exDates: ['2026-10-12T09:00:00'],\n}`,
        note: 'Composition uses civil recurrence and Temporal/fallback. Validating an event does not automatically check every future repetition.',
      },
    ],
  },
};

const featureCatalog = demos.map((demo) => ({
  ...demo,
  scenario: demo.id,
  detail: demo.description,
}));

const featureGroups = [
  {
    id: 'views',
    title: ['Views e períodos', 'Views and periods'],
    detail: [
      'Escolha a escala que corresponde ao trabalho.',
      'Choose the time span that matches the work.',
    ],
  },
  {
    id: 'resources',
    title: ['Recursos e disponibilidade', 'Resources and availability'],
    detail: [
      'Combine planejamento visual e regras de ocupação.',
      'Combine visual planning and occupancy rules.',
    ],
  },
  {
    id: 'interaction',
    title: ['Interação e persistência', 'Interaction and persistence'],
    detail: [
      'Mantenha o aplicativo no controle das alterações.',
      'Keep your application in control of changes.',
    ],
  },
  {
    id: 'integration',
    title: ['Conteúdo e distribuição', 'Content and output'],
    detail: [
      'Adapte a apresentação e compartilhe a agenda.',
      'Adapt the presentation and share the schedule.',
    ],
  },
];

function featureGroup(feature: (typeof featureCatalog)[number]) {
  if (
    [
      'ics',
      'print',
      'custom-view',
      'custom-render',
      'custom-toolbar',
      'custom-editor',
      'day-style',
    ].includes(feature.scenario)
  )
    return 'integration';
  if (
    feature.scenario === 'capacity' ||
    [
      'resources',
      'resource-week',
      'timeline-week',
      'timeline-month',
      'timeline-tree',
      'timeline',
    ].includes(feature.view)
  )
    return 'resources';
  if (
    feature.view === 'day' ||
    ['overflow', 'history', 'recurrence', 'source'].includes(feature.scenario)
  )
    return 'interaction';
  return 'views';
}

const featureScope: Record<string, [string, string]> = {
  history: [
    'Histórico da sessão; persistência e concorrência permanecem no consumidor.',
    'Session history; persistence and concurrency remain consumer-owned.',
  ],
  ics: [
    'VEVENT com diagnósticos explícitos; não oferece todo o RFC 5545.',
    'VEVENT with explicit diagnostics; the full RFC 5545 is not supported.',
  ],
  'timeline-tree': [
    'Virtualização apenas de linhas; formulários próprios devem respeitar a direção.',
    'Row virtualization only; custom forms must respect the reading direction.',
  ],
  'resource-week': [
    'Capacidade não representa sobreposição visual; confirme reservas no servidor.',
    'Capacity is separate from visual overlap; confirm bookings on the server.',
  ],
  'timeline-week': [
    'Grupos e janelas de recursos são configuráveis por view.',
    'Groups and resource windows are configured per view.',
  ],
  year: [
    'Mais eventos podem exigir a ação ver mais em cada mês.',
    'Dense months may require overflow actions.',
  ],
  'year-planner': [
    'Resumo anual; abra outra view para trabalhar com horários.',
    'Annual overview; open another view to work with times.',
  ],
  'day-agenda': [
    'A lista resume a ocupação; não substitui validação de reservas.',
    'The list summarizes occupancy; it does not replace booking validation.',
  ],
  print: [
    'Salvar como PDF depende do diálogo de impressão do navegador.',
    'Save as PDF uses the browser print dialog.',
  ],
  week: [
    'Slots, escala e intervalo de rótulos têm controles separados.',
    'Slots, scale and label intervals have separate controls.',
  ],
  month: [
    'Fins são exclusivos; eventos longos preservam a duração completa.',
    'Ends are exclusive; long events retain their full duration.',
  ],
  list: [
    'O consumidor escolhe quando trocar para uma view compacta.',
    'The consumer chooses when to switch to a compact view.',
  ],
  capacity: [
    'A validação cliente não garante reservas concorrentes no servidor.',
    'Client validation does not guarantee concurrent server bookings.',
  ],
  timeline: [
    'Virtualização de linhas exige configuração; não virtualiza todas as views.',
    'Row virtualization requires configuration; it does not virtualize every view.',
  ],
  day: [
    'Rejeitar a persistência reverte o gesto; os dados da demo duram a sessão.',
    'Rejecting persistence rolls back the gesture; demo data lasts for the session.',
  ],
  recurrence: [
    'Recorrência com exceções; não implementa todo o RFC 5545.',
    'Recurrence with exceptions; the full RFC 5545 is not implemented.',
  ],
  'external-drag': [
    'Inserir, remover e salvar pertencem aos callbacks do consumidor.',
    'Insertion, removal and persistence belong to consumer callbacks.',
  ],
  overflow: [
    'O layout de sobreposição não altera a capacidade dos recursos.',
    'Overlap layout does not change resource capacity.',
  ],
  summary: [
    'Este exemplo usa createReactView; Resumo não é uma view embutida.',
    'This example uses createReactView; Summary is not a built-in view.',
  ],
};

function DocumentationSite() {
  const [language, setLanguage] = useState<SiteLanguage>(() =>
    new URLSearchParams(window.location.search).get('lang') === 'en' ? 'en' : 'pt-BR',
  );
  const [theme, setTheme] = useState<SiteTheme>(() => {
    const requested = new URLSearchParams(window.location.search).get('theme');
    if (requested === 'system' || requested === 'light' || requested === 'dark') return requested;
    try {
      const stored = localStorage.getItem('calendara-theme');
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
      return 'system';
    }
  });
  const [search, setSearch] = useState('');
  const [featureSearch, setFeatureSearch] = useState('');
  const [featureCategory, setFeatureCategory] = useState('all');
  const [contractName, setContractName] = useState('CalendarProps');
  const text = content[language];
  const localeIndex = language === 'en' ? 1 : 0;
  const matchingFeatures = featureCatalog.filter(
    (feature) =>
      (featureCategory === 'all' || featureGroup(feature) === featureCategory) &&
      `${feature.title[localeIndex]} ${feature.detail?.[localeIndex] ?? ''} ${featureScope[feature.scenario]?.[localeIndex] ?? ''}`
        .toLocaleLowerCase()
        .includes(featureSearch.toLocaleLowerCase().trim()),
  );
  const guideUrl = `${repository}/blob/main/docs/${language}/api.md`;
  const activeContract = apiModel.find((contract) => contract.name === contractName)!;
  const filteredFields = activeContract.fields.filter((field) =>
    `${field.name} ${field.type} ${field.english} ${field.portuguese}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `Calendara — ${text.subtitle}`;
    const location = new URL(window.location.href);
    location.searchParams.set('lang', language);
    window.history.replaceState(null, '', location);
  }, [language, text.subtitle]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (preference.matches ? 'dark' : 'light') : theme;
    };
    applyTheme();
    const location = new URL(window.location.href);
    location.searchParams.set('theme', theme);
    window.history.replaceState(null, '', location);
    try {
      localStorage.setItem('calendara-theme', theme);
    } catch {
      /* Storage can be unavailable. */
    }
    preference.addEventListener('change', applyTheme);
    return () => preference.removeEventListener('change', applyTheme);
  }, [theme]);

  const demoUrl = ({
    view,
    scenario,
  }: {
    /** Optional initial view name. / PT: Nome opcional da view inicial. */
    view?: string; /** Optional playground scenario name. / PT: Nome opcional do cenário do playground. */
    scenario?: string;
  } = {}) =>
    `./examples/react.html?lang=${language}&theme=${theme}${view ? `&view=${view}` : ''}${scenario ? `&scenario=${scenario}` : ''}`;

  return (
    <>
      <a className="site-skip" href="#content">
        {text.skip}
      </a>
      <SiteHeader
        language={language}
        theme={theme}
        homeHref={`./index.html?lang=${language}&theme=${theme}`}
        onLanguageChange={(value) => setLanguage(value)}
        onThemeChange={(value) => setTheme(value)}
      />
      <div className="site-layout">
        <aside className="site-sidebar">
          <nav aria-label={text.subtitle}>
            <a href="#getting-started">{text.start}</a>
            <a href="#guides">{text.topics}</a>
            {text.topicsList.map((topic) => (
              <a className="site-nav-topic" href={`#${topic.id}`} key={topic.id}>
                {topic.title}
              </a>
            ))}
            <a href="#features">{text.catalog}</a>
            <a href="#api">{text.reference}</a>
            <a href="#bundle">{text.bundle}</a>
            <a href="#distribution">{text.distribution}</a>
            <a href="#limits">{text.limits}</a>
            <a href={demoUrl()}>{text.demo}</a>
          </nav>
          <p>{text.version}</p>
        </aside>
        <main className="site-content" id="content">
          <section className="site-introduction">
            <div>
              <h1>{text.title}</h1>
              <p>{text.introduction}</p>
              <div className="site-actions">
                <a className="site-primary" href={demoUrl()}>
                  {text.demo}
                </a>
                <a href="#getting-started">{text.start}</a>
              </div>
            </div>
            <div className="site-week-preview" role="img" aria-label={text.preview}>
              <div className="site-preview-heading">
                <strong>Calendara</strong>
                <span>{language === 'en' ? 'October 2026' : 'Outubro 2026'}</span>
              </div>
              <div className="site-preview-days">
                {text.days.map((day, index) => (
                  <span key={day}>
                    {day}
                    <b>{index + 5}</b>
                  </span>
                ))}
              </div>
              <div className="site-preview-grid">
                <span className="site-preview-time">09:00</span>
                <span className="site-preview-time">10:00</span>
                <span className="site-preview-time">11:00</span>
                <div className="site-preview-event site-preview-event-first">
                  {text.meeting}
                  <small>09:00 – 10:00</small>
                </div>
                <div className="site-preview-event site-preview-event-second">
                  {text.collection}
                  <small>10:00 – 10:30</small>
                </div>
                <div className="site-preview-event site-preview-event-third">
                  {text.review}
                  <small>11:00 – 11:30</small>
                </div>
              </div>
            </div>
          </section>

          <p className="site-experimental">{text.experimental}</p>

          <section className="site-section" id="getting-started">
            <h2>{text.start}</h2>
            <h3>{text.install}</h3>
            <p>{text.installNote}</p>
            <CodeBlock locale={language} language="bash">
              {installCommand}
            </CodeBlock>
            <p>
              {text.peer} <a href={`${repository}/releases`}>{text.release}</a>.
            </p>
            <h3>{text.render}</h3>
            <CodeBlock locale={language}>{firstCalendar}</CodeBlock>
            <p>{text.exampleNote}</p>
            <a href={`${repository}/blob/main/docs/${language}/getting-started.md`}>
              {text.fullGuide}
            </a>
          </section>

          <section className="site-section" id="guides">
            <h2>{text.topics}</h2>
            {text.topicsList.map((topic) => (
              <article className="site-topic" id={topic.id} key={topic.id}>
                <h3>{topic.title}</h3>
                <p>{topic.text}</p>
                <CodeBlock locale={language}>{topic.code}</CodeBlock>
                <p className="site-help">{topic.note}</p>
                <a
                  href={`./examples/features.html?demo=${topic.id === 'editor' ? 'custom-editor' : topic.id === 'time-axis' ? 'week' : topic.id}&lang=${language}&theme=${theme}`}
                >
                  {text.tryFeature}
                </a>
              </article>
            ))}
            <a href={guideUrl}>{text.fullGuide}</a>
            {' · '}
            <a href={`${repository}/blob/main/docs/${language}/extended-views.md`}>
              {language === 'en' ? 'Extended views and printing' : 'Views adicionais e impressão'}
            </a>
            <div className="site-integration-links">
              <a href={`${repository}/blob/main/docs/${language}/history.md`}>
                {language === 'en'
                  ? 'Undo and redo with consumer persistence'
                  : 'Desfazer e refazer com persistência do consumidor'}
              </a>
              <a href={`${repository}/blob/main/docs/${language}/ics.md`}>
                {language === 'en'
                  ? 'Import and export ICS: supported scope'
                  : 'Importar e exportar ICS: escopo suportado'}
              </a>
            </div>
          </section>

          <section className="site-section" id="features">
            <h2>{text.catalog}</h2>
            <p>{text.catalogIntro}</p>
            <div className="site-feature-controls">
              <label htmlFor="feature-search">{text.featureSearch}</label>
              <input
                id="feature-search"
                type="search"
                value={featureSearch}
                onChange={(event) => setFeatureSearch(event.target.value)}
              />
              <div className="site-feature-categories" role="group" aria-label={text.catalog}>
                <button
                  type="button"
                  aria-pressed={featureCategory === 'all'}
                  onClick={() => setFeatureCategory('all')}
                >
                  {text.allFeatures} <span>{featureCatalog.length}</span>
                </button>
                {featureGroups.map((group) => (
                  <button
                    type="button"
                    key={group.id}
                    aria-pressed={featureCategory === group.id}
                    onClick={() => setFeatureCategory(group.id)}
                  >
                    {group.title[localeIndex]}{' '}
                    <span>
                      {
                        featureCatalog.filter((feature) => featureGroup(feature) === group.id)
                          .length
                      }
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <p className="site-feature-results" role="status">
              {matchingFeatures.length === 0
                ? text.featureEmpty
                : language === 'en'
                  ? `${matchingFeatures.length} of ${featureCatalog.length} features`
                  : `${matchingFeatures.length} de ${featureCatalog.length} recursos`}
            </p>
            {featureGroups.map((group) => {
              const features = matchingFeatures.filter(
                (feature) => featureGroup(feature) === group.id,
              );
              if (!features.length) return null;
              return (
                <section
                  className="site-feature-group"
                  key={group.id}
                  aria-labelledby={`feature-${group.id}`}
                >
                  <div className="site-feature-group-heading">
                    <h3 id={`feature-${group.id}`}>{group.title[localeIndex]}</h3>
                    <p>{group.detail[localeIndex]}</p>
                  </div>
                  <div className="site-feature-catalog">
                    {features.map((feature) => (
                      <article key={feature.title[1]}>
                        <div className="site-feature-description">
                          <h4>{feature.title[localeIndex]}</h4>
                          <p>{feature.detail?.[localeIndex] ?? group.detail[localeIndex]}</p>
                          <p className="site-feature-scope">
                            <strong>{text.featureScope}: </strong>
                            {featureScope[feature.scenario]?.[localeIndex] ??
                              (language === 'en'
                                ? 'Consumer callbacks and styles control this integration.'
                                : 'Callbacks e estilos do consumidor controlam esta integração.')}
                          </p>
                        </div>
                        <div className="site-feature-action">
                          <span className="site-feature-availability">
                            {feature.view === 'summary'
                              ? language === 'en'
                                ? 'Consumer example'
                                : 'Exemplo do consumidor'
                              : text.implemented}
                          </span>
                          <a
                            data-demo-view={feature.view}
                            href={`./examples/features.html?demo=${feature.scenario}&lang=${language}&theme=${theme}`}
                          >
                            {text.tryFeature}
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
            <p>
              <a
                href={`./examples/features.html?demo=custom-render&lang=${language}&theme=${theme}`}
              >
                {language === 'en'
                  ? 'All focused examples: content, toolbar, custom views, forms and resizable container'
                  : 'Todos os exemplos focados: conteúdo, toolbar, views próprias, formulário e contêiner redimensionável'}
              </a>
            </p>
            <a href={`${repository}/blob/main/docs/${language}/features.md`}>{text.fullGuide}</a>
          </section>

          <section className="site-section" id="api">
            <h2>{text.reference}</h2>
            <p>{text.apiIntro}</p>
            <div className="site-api-controls">
              <label>
                {text.contract}
                <select
                  aria-label={text.contract}
                  value={contractName}
                  onChange={(event) => setContractName(event.target.value)}
                >
                  {apiModel.map((contract) => (
                    <option value={contract.name} key={contract.name}>
                      {contract.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {text.search}
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>
            <div className="site-api-fields">
              {filteredFields.map((field) => (
                <article className="site-api-field" key={field.name}>
                  <div className="site-api-field-heading">
                    <h3>
                      <code>{field.name}</code>
                    </h3>
                    <span>
                      {contractName === 'CalendarHandle'
                        ? text.method
                        : field.optional
                          ? text.optional
                          : text.required}
                    </span>
                  </div>
                  <p>
                    {(language === 'en' ? field.english : field.portuguese) ||
                      field.english ||
                      text.noDescription}
                  </p>
                  <pre>
                    <code>{field.type}</code>
                  </pre>
                  <a href={`${repository}/blob/main/${activeContract.source}#L${field.line}`}>
                    {text.sourceField}
                  </a>
                </article>
              ))}
              {filteredFields.length === 0 && <p role="status">{text.noResults}</p>}
            </div>
          </section>

          <section className="site-section" id="limits">
            <h2>{text.limits}</h2>
            <p>{text.limitsIntro}</p>
            <ul>
              {text.limitsList.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
            <a href={`${repository}/blob/main/docs/${language}/comparison.md`}>{text.comparison}</a>
          </section>
          <section className="site-section" id="bundle">
            <h2>{text.bundle}</h2>
            <p>{text.bundleNote}</p>
            <a href={`${repository}/blob/main/docs/${language}/bundle-comparison.md`}>
              {text.bundleLink}
            </a>
          </section>
          <section className="site-section" id="distribution">
            <h2>{text.distribution}</h2>
            <p>{text.distributionNote}</p>
            <a
              href={`${repository}/blob/main/docs/${language === 'en' ? 'publishing.md' : 'publishing.pt-BR.md'}`}
            >
              {text.distributionLink}
            </a>
            <p className="site-help">
              <a href="https://docs.github.com/en/billing/concepts/product-billing/github-packages">
                GitHub Packages: billing
              </a>
              {' · '}
              <a href="https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry">
                GitHub npm registry
              </a>
            </p>
          </section>
          <footer className="site-footer">
            <span>Calendara · MIT</span>
            <a href={`./docs/${language}/ai-integration.md`}>
              {language === 'en' ? 'AI integration' : 'Integração com IAs'}
            </a>
            <a href="./llms.txt">llms.txt</a>
            <a
              href={`${repository}/blob/main/${language === 'en' ? 'CONTRIBUTING.md' : 'CONTRIBUTING.pt-BR.md'}`}
            >
              {text.contributing}
            </a>
            <a
              href={`${repository}/blob/main/${language === 'en' ? 'SECURITY.md' : 'SECURITY.pt-BR.md'}`}
            >
              {text.security}
            </a>
          </footer>
        </main>
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<DocumentationSite />);
