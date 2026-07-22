/**
 * Ponte React↔Preact (Fase 5). O núcleo renderiza a si mesmo com Preact (ADR-002); para embutir
 * conteúdo escrito em REACT (slot de evento, toolbar custom, view via `createReactView`) montamos
 * uma "ilha": um componente Preact que cria um root do react-dom no seu próprio nó DOM e o
 * atualiza quando o `node` muda. Dois reconciliadores, cada um dono do seu nó — padrão de ilha.
 *
 * Escrito com `createElement` do Preact (SEM JSX) de propósito: este arquivo vive no pacote React
 * (cujo JSX é do React), mas o componente em si é do Preact — então evitamos ambiguidade de pragma.
 */
import { createElement, type VNode } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';

export interface ReactIslandProps {
	/** Árvore React a renderizar dentro da ilha. */
	node: ReactNode;
	/** Classe CSS do nó hospedeiro. */
	className?: string;
}

/** Componente PREACT que hospeda uma árvore React isolada (nó `div` próprio). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ReactIsland(props: ReactIslandProps): VNode<any> {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const rootRef = useRef<Root | null>(null);

	// Cria/derruba o root React junto do ciclo de vida do nó Preact.
	useEffect(() => {
		const host = hostRef.current;
		if (!host) return undefined;
		const root = createRoot(host);
		rootRef.current = root;
		return () => {
			// Desmonta em microtask: evita "unmount durante render" quando o Preact remove a ilha.
			const rootToUnmount = rootRef.current;
			rootRef.current = null;
			queueMicrotask(() => rootToUnmount?.unmount());
		};
	}, []);

	// Re-renderiza a árvore React quando o conteúdo muda.
	useEffect(() => {
		rootRef.current?.render(props.node);
	}, [props.node]);

	return createElement('div', {
		ref: hostRef,
		class: props.className,
		'data-mc-react-island': true,
	});
}
