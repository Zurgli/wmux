import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import type { Pane, PaneLeaf, PaneBranch, Workspace } from '../../../shared/types';
import { createLeafPane, generateId } from '../../../shared/types';

export interface PaneSlice {
  splitPane: (paneId: string, direction: 'horizontal' | 'vertical') => void;
  closePane: (paneId: string) => void;
  setActivePane: (paneId: string) => void;
  focusPaneDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

function findPane(root: Pane, id: string): Pane | null {
  if (root.id === id) return root;
  if (root.type === 'branch') {
    for (const child of root.children) {
      const found = findPane(child, id);
      if (found) return found;
    }
  }
  return null;
}

function findParent(root: Pane, id: string): PaneBranch | null {
  if (root.type === 'branch') {
    for (const child of root.children) {
      if (child.id === id) return root;
      const found = findParent(child, id);
      if (found) return found;
    }
  }
  return null;
}

function collectLeafIds(pane: Pane): string[] {
  if (pane.type === 'leaf') return [pane.id];
  return pane.children.flatMap(collectLeafIds);
}

function getLeafPanes(root: Pane): PaneLeaf[] {
  if (root.type === 'leaf') return [root];
  return root.children.flatMap(getLeafPanes);
}

interface PaneRect {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

function getPaneRects(
  pane: Pane,
  rect: { left: number; top: number; right: number; bottom: number },
): PaneRect[] {
  if (pane.type === 'leaf') {
    return [{
      id: pane.id,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      centerX: (rect.left + rect.right) / 2,
      centerY: (rect.top + rect.bottom) / 2,
    }];
  }

  const sizes = pane.sizes && pane.sizes.length === pane.children.length
    ? pane.sizes
    : pane.children.map(() => 100 / pane.children.length);
  const total = sizes.reduce((sum, size) => sum + size, 0) || 1;

  let offset = 0;
  const result: PaneRect[] = [];
  for (let i = 0; i < pane.children.length; i++) {
    const child = pane.children[i];
    const ratio = sizes[i] / total;
    if (pane.direction === 'horizontal') {
      const width = (rect.right - rect.left) * ratio;
      const childRect = {
        left: rect.left + offset,
        top: rect.top,
        right: rect.left + offset + width,
        bottom: rect.bottom,
      };
      result.push(...getPaneRects(child, childRect));
      offset += width;
    } else {
      const height = (rect.bottom - rect.top) * ratio;
      const childRect = {
        left: rect.left,
        top: rect.top + offset,
        right: rect.right,
        bottom: rect.top + offset + height,
      };
      result.push(...getPaneRects(child, childRect));
      offset += height;
    }
  }

  return result;
}

function overlapsOnAxis(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return Math.min(aEnd, bEnd) > Math.max(aStart, bStart);
}

export const createPaneSlice: StateCreator<StoreState, [['zustand/immer', never]], [], PaneSlice> = (set, get) => ({
  splitPane: (paneId, direction) => set((state: StoreState) => {
    const ws = state.workspaces.find((w: Workspace) => w.id === state.activeWorkspaceId);
    if (!ws) return;

    const targetPane = findPane(ws.rootPane, paneId);
    if (!targetPane || targetPane.type !== 'leaf') return;

    const newPane = createLeafPane();
    const branch: PaneBranch = {
      id: generateId('pane'),
      type: 'branch',
      direction,
      children: [{ ...targetPane }, newPane],
      sizes: [50, 50],
    };

    // Replace target with branch
    const parent = findParent(ws.rootPane, paneId);
    if (parent) {
      const idx = parent.children.findIndex((c) => c.id === paneId);
      if (idx !== -1) {
        parent.children[idx] = branch;
      }
    } else {
      // Target is the root
      ws.rootPane = branch;
    }

    ws.activePaneId = newPane.id;
  }),

  closePane: (paneId) => set((state: StoreState) => {
    const ws = state.workspaces.find((w: Workspace) => w.id === state.activeWorkspaceId);
    if (!ws) return;

    const parent = findParent(ws.rootPane, paneId);
    if (!parent) {
      // Can't close root pane, but can clear its surfaces
      return;
    }

    const idx = parent.children.findIndex((c) => c.id === paneId);
    if (idx === -1) return;

    parent.children.splice(idx, 1);

    if (parent.children.length === 1) {
      // Collapse: replace parent with the remaining child
      const remaining = parent.children[0];
      const grandParent = findParent(ws.rootPane, parent.id);
      if (grandParent) {
        const parentIdx = grandParent.children.findIndex((c) => c.id === parent.id);
        if (parentIdx !== -1) {
          grandParent.children[parentIdx] = remaining;
        }
      } else {
        // Parent was root
        ws.rootPane = remaining;
      }
    }

    // Update active pane
    const leaves = getLeafPanes(ws.rootPane);
    if (leaves.length > 0 && !leaves.some((l) => l.id === ws.activePaneId)) {
      ws.activePaneId = leaves[0].id;
    }
  }),

  setActivePane: (paneId) => set((state: StoreState) => {
    const ws = state.workspaces.find((w: Workspace) => w.id === state.activeWorkspaceId);
    if (!ws) return;
    if (findPane(ws.rootPane, paneId)) {
      ws.activePaneId = paneId;
    }
  }),

  focusPaneDirection: (direction) => set((state: StoreState) => {
    const ws = state.workspaces.find((w: Workspace) => w.id === state.activeWorkspaceId);
    if (!ws) return;

    const paneRects = getPaneRects(ws.rootPane, {
      left: 0,
      top: 0,
      right: 1,
      bottom: 1,
    });
    if (paneRects.length <= 1) return;

    const current = paneRects.find((pane) => pane.id === ws.activePaneId);
    if (!current) return;

    const candidates = paneRects.filter((pane) => {
      if (pane.id === current.id) return false;
      if (direction === 'left') {
        return pane.right <= current.left && overlapsOnAxis(pane.top, pane.bottom, current.top, current.bottom);
      }
      if (direction === 'right') {
        return pane.left >= current.right && overlapsOnAxis(pane.top, pane.bottom, current.top, current.bottom);
      }
      if (direction === 'up') {
        return pane.bottom <= current.top && overlapsOnAxis(pane.left, pane.right, current.left, current.right);
      }
      return pane.top >= current.bottom && overlapsOnAxis(pane.left, pane.right, current.left, current.right);
    });

    if (candidates.length === 0) return;

    const next = candidates.reduce((best, pane) => {
      const primaryDistance = direction === 'left'
        ? current.left - pane.right
        : direction === 'right'
          ? pane.left - current.right
          : direction === 'up'
            ? current.top - pane.bottom
            : pane.top - current.bottom;
      const secondaryDistance = direction === 'left' || direction === 'right'
        ? Math.abs(pane.centerY - current.centerY)
        : Math.abs(pane.centerX - current.centerX);

      if (!best) return { pane, primaryDistance, secondaryDistance };
      if (primaryDistance < best.primaryDistance) return { pane, primaryDistance, secondaryDistance };
      if (primaryDistance === best.primaryDistance && secondaryDistance < best.secondaryDistance) {
        return { pane, primaryDistance, secondaryDistance };
      }
      return best;
    }, null as { pane: PaneRect; primaryDistance: number; secondaryDistance: number } | null);

    if (next) {
      ws.activePaneId = next.pane.id;
    }
  }),
});
