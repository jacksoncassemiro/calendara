import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import apiModel from './generated/api-model.json';
import './docs-site.css';

type Language = 'pt-BR' | 'en';
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
    version: '0.1.0 em preparação · MIT',
    install: 'Instale uma versão publicada',
    installNote:
      'Copie a URL do arquivo .tgz de uma GitHub Release publicada. O endereço abaixo mostra o formato previsto da primeira versão; confirme a disponibilidade antes de instalar.',
    peer: 'React e React DOM 18 ou 19 são peers. Use versões compatíveis. Importar o CSS é necessário para o tema padrão; Tailwind não é exigido.',
    release: 'Ver releases',
    render: 'Escolha as views e renderize',
    exampleNote:
      'A lista views é o conjunto completo. Se omitida, oferece semana, dia, mês e agenda. initialView configura somente a montagem; a primeira view é o default.',
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
      'Editor padrão em português; formulários próprios podem usar outros idiomas.',
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
    version: '0.1.0 in preparation · MIT',
    install: 'Install a published version',
    installNote:
      'Copy the .tgz asset URL from a published GitHub Release. The address below shows the planned first-version format; verify availability before installing.',
    peer: 'React and React DOM 18 or 19 are peers. Use matching versions. Import CSS for the default theme; Tailwind is not required.',
    release: 'Browse releases',
    render: 'Choose views and render',
    exampleNote:
      'views is the complete set. Omission includes week, day, month and agenda. initialView only configures mount; the first view is the default.',
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
      'The built-in editor is Portuguese; custom forms can use other languages.',
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

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="site-code">
      <code>{children}</code>
    </pre>
  );
}

function DocumentationSite() {
  const [language, setLanguage] = useState<Language>(() =>
    new URLSearchParams(window.location.search).get('lang') === 'en' ? 'en' : 'pt-BR',
  );
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

  return (
    <>
      <a className="site-skip" href="#content">
        {text.skip}
      </a>
      <header className="site-header">
        <a className="site-brand" href="#content" aria-label="Calendara">
          <span className="site-brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Calendara
        </a>
        <span className="site-header-description">{text.subtitle}</span>
        <nav className="site-header-actions" aria-label={text.language}>
          <button
            type="button"
            lang="pt-BR"
            aria-pressed={language === 'pt-BR'}
            onClick={() => setLanguage('pt-BR')}
          >
            PT
          </button>
          <button
            type="button"
            lang="en"
            aria-pressed={language === 'en'}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
          <a href={repository}>GitHub</a>
        </nav>
      </header>
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
            <a href="#api">{text.reference}</a>
            <a href="#limits">{text.limits}</a>
            <a href="./examples/react.html">{text.demo}</a>
          </nav>
          <p>{text.version}</p>
        </aside>
        <main className="site-content" id="content">
          <section className="site-introduction">
            <div>
              <h1>{text.title}</h1>
              <p>{text.introduction}</p>
              <div className="site-actions">
                <a className="site-primary" href="./examples/react.html">
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
