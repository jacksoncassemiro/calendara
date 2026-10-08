import { useLayoutEffect, useRef } from 'react';
import './site-header.css';

export type SiteLanguage = 'pt-BR' | 'en';
export type SiteTheme = 'system' | 'light' | 'dark';

type SiteHeaderProps = {
  language: SiteLanguage;
  theme: SiteTheme;
  homeHref: string;
  onLanguageChange: (language: SiteLanguage) => void;
  onThemeChange: (theme: SiteTheme) => void;
};

export function SiteHeader({
  language,
  theme,
  homeHref,
  onLanguageChange,
  onThemeChange,
}: SiteHeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const english = language === 'en';
  const themeLabels = english ? ['System', 'Light', 'Dark'] : ['Sistema', 'Claro', 'Escuro'];
  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const updateHeight = () => {
      document.documentElement.style.setProperty(
        '--calendara-header-height',
        `${header.getBoundingClientRect().height}px`,
      );
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--calendara-header-height');
    };
  }, []);

  return (
    <header ref={headerRef} className="calendara-site-header">
      <a className="calendara-site-brand" href={homeHref} aria-label="Calendara">
        <span className="calendara-site-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        Calendara
      </a>
      <nav
        className="calendara-site-navigation"
        aria-label={english ? 'Project navigation' : 'Navegação do projeto'}
      >
        <a href={`${homeHref}#getting-started`}>{english ? 'Documentation' : 'Documentação'}</a>
        <a href={`${homeHref}#api`}>API</a>
        <a href="https://github.com/jacksoncassemiro/calendara">GitHub</a>
      </nav>
      <div className="calendara-site-preferences">
        <div
          className="calendara-site-toggle"
          role="group"
          aria-label={english ? 'Language' : 'Idioma'}
        >
          <button
            type="button"
            lang="pt-BR"
            aria-pressed={!english}
            onClick={() => onLanguageChange('pt-BR')}
          >
            PT
          </button>
          <button
            type="button"
            lang="en"
            aria-pressed={english}
            onClick={() => onLanguageChange('en')}
          >
            EN
          </button>
        </div>
        <div className="calendara-site-toggle" role="group" aria-label={english ? 'Theme' : 'Tema'}>
          {(['system', 'light', 'dark'] as const).map((value, index) => (
            <button
              key={value}
              type="button"
              aria-label={themeLabels[index]}
              title={themeLabels[index]}
              aria-pressed={theme === value}
              onClick={() => onThemeChange(value)}
            >
              <span aria-hidden="true">{['◐', '☀', '☾'][index]}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
