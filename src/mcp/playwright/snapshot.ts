import type { Page, ElementHandle } from 'playwright-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SnapshotOptions {
  /** 'ai' = interactive elements with ref, 'aria' = full tree */
  format?: 'ai' | 'aria';
  /** Maximum tree depth (default 10) */
  depth?: number;
  /** Maximum output length in characters (default 50000) */
  maxLength?: number;
}

/** CDP Accessibility.AXNode shape (subset of fields we use) */
interface CdpAXNode {
  nodeId: string;
  backendDOMNodeId?: number;
  role?: { type: string; value: string };
  name?: { type: string; value: string };
  value?: { type: string; value: string };
  description?: { type: string; value: string };
  properties?: Array<{ name: string; value: { type: string; value: any } }>;
  childIds?: string[];
  parentId?: string;
  ignored?: boolean;
}

/** Normalised tree node built from CDP data */
interface AXNode {
  role: string;
  name: string;
  value?: string;
  description?: string;
  children?: AXNode[];
  backendDOMNodeId?: number;
  // properties
  checked?: boolean | 'mixed';
  disabled?: boolean;
  expanded?: boolean;
  focused?: boolean;
  level?: number;
  selected?: boolean;
  pressed?: boolean | 'mixed';
  valuetext?: string;
}

// Roles considered interactive — these get a ref number in 'ai' format
const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'checkbox',
  'radio',
  'combobox',
  'listbox',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'treeitem',
]);

// ---------------------------------------------------------------------------
// CDP → AXNode tree builder
// ---------------------------------------------------------------------------

function buildTree(nodes: CdpAXNode[]): AXNode | null {
  if (nodes.length === 0) return null;

  const map = new Map<string, CdpAXNode>();
  for (const n of nodes) map.set(n.nodeId, n);

  function convert(cdp: CdpAXNode): AXNode | null {
    if (cdp.ignored) return null;

    const role = cdp.role?.value ?? 'none';
    const name = cdp.name?.value ?? '';

    const node: AXNode = { role, name };
    if (cdp.value?.value) node.value = cdp.value.value;
    if (cdp.description?.value) node.description = cdp.description.value;
    if (cdp.backendDOMNodeId !== undefined) node.backendDOMNodeId = cdp.backendDOMNodeId;

    // Extract boolean/enum properties
    if (cdp.properties) {
      for (const prop of cdp.properties) {
        switch (prop.name) {
          case 'checked':
            node.checked = prop.value.value === 'mixed' ? 'mixed' : !!prop.value.value;
            break;
          case 'disabled':
            node.disabled = !!prop.value.value;
            break;
          case 'expanded':
            node.expanded = !!prop.value.value;
            break;
          case 'focused':
            node.focused = !!prop.value.value;
            break;
          case 'level':
            node.level = Number(prop.value.value);
            break;
          case 'selected':
            node.selected = !!prop.value.value;
            break;
          case 'pressed':
            node.pressed = prop.value.value === 'mixed' ? 'mixed' : !!prop.value.value;
            break;
          case 'valuetext':
            node.valuetext = String(prop.value.value);
            break;
        }
      }
    }

    // Build children
    if (cdp.childIds && cdp.childIds.length > 0) {
      const children: AXNode[] = [];
      for (const cid of cdp.childIds) {
        const child = map.get(cid);
        if (child) {
          const converted = convert(child);
          if (converted) children.push(converted);
        }
      }
      if (children.length > 0) node.children = children;
    }

    return node;
  }

  return convert(nodes[0]);
}

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

export interface RefEntry {
  role: string;
  name: string;
  backendDOMNodeId?: number;
}

/** Per-page storage of the last generated refMap to avoid concurrency issues */
const pageRefMaps = new WeakMap<Page, RefEntry[]>();

function isInteractive(role: string): boolean {
  return INTERACTIVE_ROLES.has(role);
}

function serializeNode(
  node: AXNode,
  format: 'ai' | 'aria',
  currentDepth: number,
  maxDepth: number,
  indent: number,
  refs: RefEntry[],
): string {
  if (currentDepth > maxDepth) return '';

  const pad = '  '.repeat(indent);
  const role = node.role;
  const name = node.name || '';

  // Build attribute string
  const attrs: string[] = [];

  if (format === 'ai' && isInteractive(role)) {
    const ref = refs.length;
    refs.push({ role, name, backendDOMNodeId: node.backendDOMNodeId });
    attrs.push(`ref="${ref}"`);
  }

  if (node.checked !== undefined) attrs.push(`checked="${node.checked}"`);
  if (node.disabled) attrs.push('disabled');
  if (node.expanded !== undefined) attrs.push(`expanded="${node.expanded}"`);
  if (node.selected) attrs.push('selected');
  if (node.level !== undefined) attrs.push(`level="${node.level}"`);
  if (node.valuetext) attrs.push(`valuetext="${node.valuetext}"`);
  if (node.value) attrs.push(`value="${node.value}"`);

  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
  const nameStr = name ? ` "${name}"` : '';

  let line = `${pad}- ${role}${nameStr}${attrStr}`;

  // Recurse into children
  const childLines: string[] = [];
  if (node.children) {
    for (const child of node.children) {
      const childStr = serializeNode(child, format, currentDepth + 1, maxDepth, indent + 1, refs);
      if (childStr) childLines.push(childStr);
    }
  }

  if (childLines.length > 0) {
    line += '\n' + childLines.join('\n');
  }

  return line;
}

function serializeTree(
  root: AXNode,
  format: 'ai' | 'aria',
  maxDepth: number,
  refs: RefEntry[],
): string {
  const children = root.children ?? [root];
  const lines: string[] = [];

  for (const child of children) {
    const s = serializeNode(child, format, 0, maxDepth, 0, refs);
    if (s) lines.push(s);
  }

  return lines.join('\n');
}

function stripNonInteractive(node: AXNode): AXNode | null {
  if (isInteractive(node.role)) return node;

  if (!node.children) return null;

  const filtered = node.children
    .map(stripNonInteractive)
    .filter((c): c is AXNode => c !== null);

  if (filtered.length === 0) return null;

  return { ...node, children: filtered };
}

// ---------------------------------------------------------------------------
// CDP helpers
// ---------------------------------------------------------------------------

async function getAccessibilityTree(page: Page): Promise<AXNode | null> {
  const client = await page.context().newCDPSession(page);
  try {
    const { nodes } = await client.send('Accessibility.getFullAXTree' as any) as { nodes: CdpAXNode[] };
    return buildTree(nodes);
  } finally {
    await client.detach().catch(() => { /* best-effort */ });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an accessibility-tree snapshot of the page.
 *
 * In 'ai' format every interactive element receives a sequential `ref="N"`
 * attribute that can later be resolved back to an ElementHandle via
 * `resolveRef()`.
 *
 * Uses CDP `Accessibility.getFullAXTree` under the hood to obtain a
 * structured tree that can be filtered and annotated.
 */
export async function generateSnapshot(
  page: Page,
  options?: SnapshotOptions,
): Promise<string> {
  const format = options?.format ?? 'ai';
  const depth = options?.depth ?? 10;
  const maxLength = options?.maxLength ?? 50_000;

  const tree = await getAccessibilityTree(page);

  if (!tree) {
    pageRefMaps.set(page, []);
    return '(empty page)';
  }

  let refs: RefEntry[] = [];
  let output = serializeTree(tree, format, depth, refs);

  // If the output exceeds maxLength AND we are in 'ai' mode, strip
  // non-interactive nodes and regenerate.
  if (output.length > maxLength && format === 'ai') {
    const trimmed = stripNonInteractive(tree);
    if (trimmed) {
      refs = [];
      output = serializeTree(trimmed, format, depth, refs);
    }
  }

  // Hard-truncate as a last resort
  if (output.length > maxLength) {
    output = output.slice(0, maxLength) + '\n... (truncated)';
  }

  // Store the refMap for this page so resolveRef can use it without re-querying
  pageRefMaps.set(page, refs);

  return output;
}

/**
 * Resolve a ref number (produced by `generateSnapshot` with format='ai')
 * back to a live ElementHandle.
 *
 * Uses the refMap stored during the last `generateSnapshot()` call for
 * the same page, avoiding a full accessibility tree re-query.
 *
 * Falls back to role-based locator matching using the stored role+name.
 */
export async function resolveRef(
  page: Page,
  ref: string,
): Promise<ElementHandle | null> {
  const targetIndex = parseInt(ref, 10);
  if (Number.isNaN(targetIndex) || targetIndex < 0) return null;

  const refs = pageRefMaps.get(page);
  if (!refs || targetIndex >= refs.length) return null;

  const target = refs[targetIndex];

  // Use Playwright's getByRole to locate the element
  try {
    const locator = page.getByRole(target.role as any, {
      name: target.name || undefined,
      exact: true,
    });

    const count = await locator.count();
    if (count === 0) return null;

    // Find which instance corresponds to our ref by counting all
    // refs with the same role+name before our target index
    let sameRoleNameBefore = 0;
    for (let i = 0; i < targetIndex; i++) {
      if (
        refs[i].role === target.role &&
        refs[i].name === target.name
      ) {
        sameRoleNameBefore++;
      }
    }

    const nth = Math.min(sameRoleNameBefore, count - 1);
    return await locator.nth(nth).elementHandle();
  } catch {
    return null;
  }
}
