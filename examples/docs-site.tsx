import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import apiModel from './generated/api-model.json';
import './docs-site.css';
import { SiteHeader, type SiteLanguage, type SiteTheme } from './components/SiteHeader';

const repository = 'https://github.com/jacksoncassemiro/calendara';
const installCommand =
  'yarn add https://github.com/jacksoncassemiro/calendara/releases/download/v0.1.0/calendara-0.1.0.tgz';
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
    tryFeature: 'Abrir demonstração',
    bundle: 'Tamanho e organização do pacote',
    bundleNote:
      'Mês + dia: 142,4 kB gzip no ensaio de produção, excluindo React e CSS e incluindo todos os chunks. FullCalendar: 70,6 kB; Schedule-X: 68,7 kB; Mantine: 85,1 kB; React Big Calendar: 54,9 kB. Os recursos e runtimes não são equivalentes. Mantemos um pacote: separar instalações não elimina o custo compartilhado de recorrência e datas.',
    bundleLink: 'Metodologia, versões e resultados reproduzíveis',
    distribution: 'Distribuição no GitHub',
    distributionNote:
      'A versão experimental 0.1.0 está publicada com .tgz e checksum. Instale pela URL fixa da release; o site e o pacote têm publicações separadas. GitHub Packages público é gratuito, mas o registro npm do GitHub exige autenticação até para instalar pacotes públicos. Escolhemos assets de GitHub Releases para evitar essa configuração no consumidor.',
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
    version: '0.1.0 · MIT',
    install: 'Instale uma versão publicada',
    installNote:
      'Copie a URL do arquivo .tgz de uma GitHub Release publicada. O endereço abaixo mostra o formato previsto da primeira versão; confirme a disponibilidade antes de instalar.',
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
      'Recorrência diária, semanal, mensal e anual com exceções; não oferece todo o RFC 5545.',
      'Recursos e editor são MIT. Não há virtualização, ICS, impressão, undo/redo ou RTL completo.',
      'Editor padrão em português e inglês; formulários próprios podem usar outros idiomas.',
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
        code: `async function commit(change: EventChange) {\n  await persistChange(change);\n  setEvents(current => applyEventTimeChange(current, change));\n}\n\n<Calendar views={views} events={events}\n  onEventDrop={commit} onEventResize={commit} />;`,
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
        note: 'A composição usa rrule-temporal e Temporal/fallback. Uma validação do evento não verifica automaticamente todas as repetições futuras.',
      },
    ],
  },
  en: {
    theme: 'Theme',
    themeOptions: ['System', 'Light', 'Dark'],
    catalog: 'Explore features',
    tryFeature: 'Open demonstration',
    bundle: 'Bundle size and package structure',
    bundleNote:
      'Month + Day: 142.4 kB gzip in the production fixture, excluding React and CSS and including every chunk. FullCalendar: 70.6 kB; Schedule-X: 68.7 kB; Mantine: 85.1 kB; React Big Calendar: 54.9 kB. Features and runtimes differ. We retain one package: separate installations do not remove shared recurrence and date costs.',
    bundleLink: 'Methodology, versions and reproducible results',
    distribution: 'GitHub distribution',
    distributionNote:
      'Experimental version 0.1.0 is published with a .tgz and checksum. Install using the fixed release URL; the site and package are published separately. Public GitHub Packages are free, but its npm registry requires authentication even when installing public packages. We chose GitHub Release assets to avoid that consumer setup.',
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
    version: '0.1.0 · MIT',
    install: 'Install a published version',
    installNote:
      'Copy the .tgz asset URL from a published GitHub Release. The address below shows the planned first-version format; verify availability before installing.',
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
      'Daily, weekly, monthly and yearly recurrence with exceptions; not the whole RFC 5545.',
      'Resource views and editor are MIT. No virtualization, ICS, printing, undo/redo or full RTL.',
      'The built-in editor supports Portuguese and English; custom forms can use other languages.',
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
        code: `async function commit(change: EventChange) {\n  await persistChange(change);\n  setEvents(current => applyEventTimeChange(current, change));\n}\n\n<Calendar views={views} events={events}\n  onEventDrop={commit} onEventResize={commit} />;`,
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
        note: 'Composition uses rrule-temporal and Temporal/fallback. Validating an event does not automatically check every future repetition.',
      },
    ],
  },
};

const featureCatalog = [
  {
    view: 'week',
    title: ['Semana, dia e períodos personalizados', 'Week, day and custom periods'],
    detail: [
      'Slots, snapping, escala e rótulos independentes. Altere as opções de tempo no playground.',
      'Independent slots, snapping, scale and labels. Change time options in the playground.',
    ],
  },
  {
    view: 'month',
    title: ['Mês e eventos entre dias', 'Month and multi-day events'],
    detail: [
      'Eventos contínuos por semana e +mais com popover, componente próprio ou outra view.',
      'Continuous events within each week and +more with a popover, custom component or another view.',
    ],
  },
  {
    view: 'list',
    title: ['Agenda e telas menores', 'Agenda and narrow screens'],
    detail: [
      'Lista por data; a aplicação pode trocar para modo compacto e abrir seu formulário.',
      'Date-grouped list; applications can choose compact mode and open their own form.',
    ],
  },
  {
    view: 'resources',
    scenario: 'capacity',
    title: ['Salas e disponibilidade', 'Rooms and availability'],
    detail: [
      'Capacidade global, por sala ou ilimitada; bloqueios e buffers separados da sobreposição visual.',
      'Global, per-room or unlimited capacity; blocks and buffers are separate from visual overlap.',
    ],
  },
  {
    view: 'timeline',
    title: ['Linha de tempo por recurso', 'Resource timeline'],
    detail: [
      'Horários na horizontal, recursos na vertical; escala configurável e scroll horizontal.',
      'Horizontal time, vertical resources; configurable scale and horizontal scrolling.',
    ],
  },
  {
    view: 'day',
    title: ['Mover, redimensionar e salvar', 'Move, resize and save'],
    detail: [
      'Prévia do gesto, horários atualizados, rejeição assíncrona e cancelamento. Dados desta demo ficam em memória.',
      'Gesture preview, updated times, async rejection and cancellation. Demo data stays in memory.',
    ],
  },
  {
    view: 'day',
    scenario: 'recurrence',
    title: ['Recorrência e seu editor', 'Recurrence and your editor'],
    detail: [
      'Abra um evento para editar repetições e exceções. O editor padrão é opcional; seus callbacks controlam o fluxo.',
      'Open an event to edit repetitions and exceptions. The built-in editor is optional; callbacks control the flow.',
    ],
  },
  {
    view: 'day',
    scenario: 'external-drag',
    title: ['Transferências de eventos', 'Event transfers'],
    detail: [
      'Arraste um modelo para dentro e um evento para a área externa. A aplicação decide inserir, salvar ou remover.',
      'Drag a template in and an event to the outside area. The application decides insertion, persistence or removal.',
    ],
  },
  {
    view: 'day',
    scenario: 'overflow',
    title: ['Eventos próximos e sobreposição', 'Dense events and overlap'],
    detail: [
      'Compare lado a lado, sobreposição parcial e +mais. Capacidade continua independente do layout.',
      'Compare side-by-side, partial overlap and +more. Capacity remains independent of layout.',
    ],
  },
  {
    view: 'summary',
    title: ['Views e conteúdo próprios', 'Custom views and content'],
    detail: [
      'Resumo é uma view do exemplo, criada com createReactView; não é uma view embutida do pacote.',
      'Summary is an example view created with createReactView, not a built-in package view.',
    ],
  },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="site-code">
      <code>{children}</code>
    </pre>
  );
}

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
  const [contractName, setContractName] = useState('CalendarProps');
  const text = content[language];
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

  const demoUrl = (view?: string, scenario?: string) =>
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
            <CodeBlock>{installCommand}</CodeBlock>
            <p>
              {text.peer} <a href={`${repository}/releases`}>{text.release}</a>.
            </p>
            <h3>{text.render}</h3>
            <CodeBlock>{firstCalendar}</CodeBlock>
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
                <CodeBlock>{topic.code}</CodeBlock>
                <p className="site-help">{topic.note}</p>
              </article>
            ))}
            <a href={guideUrl}>{text.fullGuide}</a>
          </section>

          <section className="site-section" id="features">
            <h2>{text.catalog}</h2>
            <div className="site-feature-catalog">
              {featureCatalog.map((feature) => (
                <article key={feature.title[1]}>
                  <h3>{feature.title[language === 'en' ? 1 : 0]}</h3>
                  <p>{feature.detail[language === 'en' ? 1 : 0]}</p>
                  <a href={demoUrl(feature.view, feature.scenario)}>{text.tryFeature}</a>
                </article>
              ))}
            </div>
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
