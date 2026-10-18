import Ajv2020 from 'ajv/dist/2020';
import type { SpecIssue } from '../../lib/api';

export type Draft = Record<string, unknown>;
export interface SchemaNode {
  $ref?: string;
  title?: string;
  description?: string;
  type?: string;
  enum?: (string | number)[];
  anyOf?: SchemaNode[];
  properties?: Record<string, SchemaNode>;
  required?: string[];
  items?: SchemaNode;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  default?: unknown;
  $defs?: Record<string, SchemaNode>;
}

export function resolveNode(node: SchemaNode, root: SchemaNode): SchemaNode {
  if (node.$ref) return resolveNode(root.$defs?.[node.$ref.split('/').pop()!] ?? {}, root);
  if (node.anyOf) return resolveNode(node.anyOf.find((n) => n.type !== 'null') ?? {}, root);
  return node;
}

export function changeAt(draft: Draft, path: string[], value: unknown): Draft {
  const next = structuredClone(draft);
  let cursor = next;
  for (const part of path.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part] as Draft;
  }
  cursor[path[path.length - 1]] = value;
  return next;
}

export function schemaValidator(schema: object) {
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  return (draft: Draft): SpecIssue[] => {
    if (validate(draft)) return [];
    return (validate.errors ?? []).filter((e) => e.keyword !== 'anyOf').map((e) => ({
      path: [
        ...e.instancePath.split('/').filter(Boolean).map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~')),
        ...(e.keyword === 'required' ? [e.params.missingProperty] : []),
      ],
      message: e.message ?? 'Invalid value',
    }));
  };
}

export const fieldId = (path: (string | number)[]) => `spec-${path.join('-')}`;
