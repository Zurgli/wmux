import { useEffect } from 'react';

/**
 * Global guard: blocks Electron webview pointer capture while any panel
 * separator is being dragged.
 *
 * CSS `pointer-events: none` does NOT work for Electron `<webview>` tags
 * because webviews run in a separate renderer process and capture input at
 * the compositor level, bypassing host-page CSS entirely.
 *
 * Instead, we inject a transparent `<div>` overlay that covers the entire
 * viewport (position:fixed, inset:0, z-index:99999).  This overlay is a
 * regular DOM element so it properly participates in the host page's
 * hit-testing and blocks pointer events from reaching the webview's
 * compositor layer.
 *
 * The overlay is created on `pointerdown` over a `[data-separator]` element
 * and removed on `pointerup` / `pointercancel`.
 *
 * Call this once from a top-level layout component.
 */
export function useResizeGuard(): void {
  useEffect(() => {
    let overlay: HTMLDivElement | null = null;

    function createOverlay() {
      if (overlay) return;
      overlay = document.createElement('div');
      overlay.id = 'wmux-resize-overlay';
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:99999;cursor:col-resize;background:transparent;';
      document.body.appendChild(overlay);
    }

    function removeOverlay() {
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
    }

    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const separator = target.closest('[data-separator]');
      if (!separator) return;

      // Detect orientation from the separator's parent Group
      const group = separator.closest('[data-panel-group]');
      const isVertical = group?.getAttribute('data-panel-group-direction') === 'vertical';

      createOverlay();
      if (overlay) {
        overlay.style.cursor = isVertical ? 'row-resize' : 'col-resize';
      }

      const cleanup = () => {
        removeOverlay();
        window.removeEventListener('pointerup', cleanup);
        window.removeEventListener('pointercancel', cleanup);
      };
      window.addEventListener('pointerup', cleanup, { once: true });
      window.addEventListener('pointercancel', cleanup, { once: true });
    }

    // Capture phase so we see the event before the library
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      removeOverlay();
    };
  }, []);
}
