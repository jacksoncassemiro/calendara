import { useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import './code-block.css';

/** Copyable, highlighted example source. PT: Código do exemplo com destaque e cópia. */
export function CodeBlock({
  children,
  language = 'tsx',
  locale,
}: {
  /** Source text copied verbatim. PT: Texto fonte copiado sem alterações. */
  children: string;
  /** Syntax grammar; defaults to TSX. PT: Linguagem do código; padrão TSX. */
  language?: 'tsx' | 'json' | 'bash';
  /** Language of copy feedback. PT: Idioma do retorno da cópia. */
  locale: string;
}) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const portuguese = locale.startsWith('pt');
  const highlighted = Prism.highlight(children, Prism.languages[language]!, language);
  return (
    <div className="example-code">
      <div className="example-code-toolbar">
        <span>{language.toUpperCase()}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(children);
              setCopyStatus('copied');
            } catch {
              setCopyStatus('failed');
            }
          }}
        >
          {portuguese ? 'Copiar código' : 'Copy code'}
        </button>
        <span role="status">
          {copyStatus === 'copied'
            ? portuguese
              ? 'Copiado'
              : 'Copied'
            : copyStatus === 'failed'
              ? portuguese
                ? 'Selecione o código para copiar'
                : 'Select the code to copy'
              : ''}
        </span>
      </div>
      <pre tabIndex={0} aria-label={portuguese ? 'Código do exemplo' : 'Example code'}>
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}
