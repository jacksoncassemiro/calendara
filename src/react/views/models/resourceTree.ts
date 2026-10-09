import type { CalendarResource } from '../../../core/index.js';

/** Ordered resource and its nesting level. PT: Recurso ordenado e nível na árvore. */
export interface ResourceTreeRow {
  /** Original resource. PT: Recurso original. */
  resource: CalendarResource;
  /** Zero-based nesting level. PT: Nível de aninhamento, base zero. */
  depth: number;
  /** Whether this resource has children. PT: Se o recurso possui filhos. */
  hasChildren: boolean;
}

/** Flatten a resource tree without inheriting occupancy rules. PT: Ordena a árvore sem herdar regras de ocupação. */
export function resourceTreeRows({
  resources,
  collapsed,
  hierarchy,
}: {
  /** Ordered input resources. PT: Recursos de entrada ordenados. */
  resources: readonly CalendarResource[];
  /** Collapsed parent identifiers. PT: Identificadores dos pais recolhidos. */
  collapsed: ReadonlySet<string>;
  /** Enable parentId hierarchy. PT: Habilita hierarquia por parentId. */
  hierarchy: boolean;
}): ResourceTreeRow[] {
  if (!hierarchy) return resources.map((resource) => ({ resource, depth: 0, hasChildren: false }));
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const children = new Map<string, CalendarResource[]>();
  const roots: CalendarResource[] = [];
  for (const resource of resources) {
    const path = new Set<string>();
    let ancestor: CalendarResource | undefined = resource;
    while (ancestor) {
      if (path.has(ancestor.id))
        throw new RangeError('[calendara] resource hierarchy contains a cycle');
      path.add(ancestor.id);
      ancestor = ancestor.parentId ? byId.get(ancestor.parentId) : undefined;
    }
    if (!resource.parentId || !byId.has(resource.parentId)) roots.push(resource);
    else {
      const members = children.get(resource.parentId) ?? [];
      members.push(resource);
      children.set(resource.parentId, members);
    }
  }
  const result: ResourceTreeRow[] = [];
  const visit = (resource: CalendarResource, depth: number): void => {
    const members = children.get(resource.id) ?? [];
    result.push({ resource, depth, hasChildren: members.length > 0 });
    if (!collapsed.has(resource.id)) members.forEach((member) => visit(member, depth + 1));
  };
  roots.forEach((resource) => visit(resource, 0));
  return result;
}
