import type { Page } from 'playwright-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IndexedElement {
  /** 1-based index */
  ref: number;
  /** Accessibility role: button, link, textbox, etc. */
  role: string;
  /** Visible text or label */
  name: string;
  /** Current value for inputs */
  value?: string;
  /** aria-description if available */
  description?: string;
  /** Playwright locator string to find this element */
  locator: string;
}

export interface SmartSnapshot {
  url: string;
  title: string;
  elements: IndexedElement[];
  /** Truncated page text content */
  content: string;
}

export interface SmartSnapshotOptions {
  /** Maximum length for the page text content (default 3000) */
  maxContentLength?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_CONTENT_LENGTH = 3000;

/** Roles considered interactive — elements with these roles get indexed */
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
// CDP Accessibility types (subset of fields we use)
// ---------------------------------------------------------------------------

interface CdpAXNode {
  nodeId: string;
  role?: { type: string; value: string };
  name?: { type: string; value: string };
  value?: { type: string; value: string };
  description?: { type: string; value: string };
  childIds?: string[];
  ignored?: boolean;
}

// ---------------------------------------------------------------------------
// Element cache — stores indexed elements from the last snapshot
// ---------------------------------------------------------------------------

let elementCache: IndexedElement[] = [];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Escape special characters in a string for use inside a Playwright
 * locator expression (e.g. `getByRole('button', { name: '...' })`).
 */
function escapeLocatorName(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Build a Playwright locator string for a given role and name.
 *
 * If the name is empty, falls back to `getByRole('role')` without a
 * name filter. When duplicate names exist for the same role, callers
 * should use `.nth()` — but we provide the base locator here.
 */
function buildLocatorString(role: string, name: string): string {
  if (!name) {
    return `getByRole('${role}')`;
  }
  return `getByRole('${role}', { name: '${escapeLocatorName(name)}' })`;
}

/**
 * Recursively walk the CDP accessibility tree and collect interactive
 * elements into the provided array, assigning 1-based ref numbers.
 */
function collectInteractiveElements(
  nodeMap: Map<string, CdpAXNode>,
  node: CdpAXNode,
  elements: IndexedElement[],
): void {
  if (node.ignored) return;

  const role = node.role?.value ?? 'none';
  const name = node.name?.value ?? '';

  if (INTERACTIVE_ROLES.has(role)) {
    const ref = elements.length + 1; // 1-based
    const element: IndexedElement = {
      ref,
      role,
      name,
      locator: buildLocatorString(role, name),
    };

    if (node.value?.value) {
      element.value = node.value.value;
    }
    if (node.description?.value) {
      element.description = node.description.value;
    }

    elements.push(element);
  }

  // Recurse into children
  if (node.childIds) {
    for (const childId of node.childIds) {
      const child = nodeMap.get(childId);
      if (child) {
        collectInteractiveElements(nodeMap, child, elements);
      }
    }
  }
}

/**
 * Fetch the full accessibility tree via CDP and return indexed interactive
 * elements.
 */
async function getInteractiveElements(page: Page): Promise<IndexedElement[]> {
  const client = await page.context().newCDPSession(page);
  try {
    const { nodes } = (await client.send('Accessibility.getFullAXTree' as any)) as {
      nodes: CdpAXNode[];
    };

    if (nodes.length === 0) return [];

    // Build a map for quick lookup by nodeId
    const nodeMap = new Map<string, CdpAXNode>();
    for (const n of nodes) nodeMap.set(n.nodeId, n);

    const elements: IndexedElement[] = [];
    collectInteractiveElements(nodeMap, nodes[0], elements);
    return elements;
  } finally {
    await client.detach().catch(() => {
      /* best-effort cleanup */
    });
  }
}

/**
 * Retrieve truncated page text content.
 */
async function getPageContent(page: Page, maxLength: number): Promise<string> {
  try {
    const text = await page.innerText('body');
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '\n... (truncated)';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a "smart snapshot" of the page: a structured representation
 * containing only interactive elements (with 1-based ref indices) plus a
 * truncated text summary of the page content.
 *
 * The indexed elements are cached internally so that `getLocatorByRef()`
 * can resolve a ref number back to a Playwright locator string without
 * re-querying the page.
 */
export async function getSmartSnapshot(
  page: Page,
  options?: SmartSnapshotOptions,
): Promise<SmartSnapshot> {
  const maxContentLength = options?.maxContentLength ?? DEFAULT_MAX_CONTENT_LENGTH;

  const [url, title, elements, content] = await Promise.all([
    Promise.resolve(page.url()),
    page.title(),
    getInteractiveElements(page),
    getPageContent(page, maxContentLength),
  ]);

  // Update element cache
  elementCache = elements;

  return { url, title, elements, content };
}

/**
 * Look up a Playwright locator string by the 1-based ref number assigned
 * during the most recent `getSmartSnapshot()` call.
 *
 * Returns `null` if the ref is out of range or no snapshot has been taken.
 */
export function getLocatorByRef(ref: number): string | null {
  if (ref < 1 || ref > elementCache.length) return null;
  return elementCache[ref - 1].locator;
}

/**
 * Clear the cached element list. Useful when navigating to a new page
 * to avoid stale refs.
 */
export function clearElementCache(): void {
  elementCache = [];
}
