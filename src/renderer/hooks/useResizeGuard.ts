import { useCallback } from 'react';

/**
 * Block webview pointer capture while dragging a panel separator.
 * Returns a mousedown handler that toggles `wmux-resizing` on `document.body`.
 */
export function useResizeGuard() {
  return useCallback(() => {
    document.body.classList.add('wmux-resizing');
    const cleanup = () => {
      document.body.classList.remove('wmux-resizing');
      window.removeEventListener('mouseup', cleanup);
      window.removeEventListener('pointerup', cleanup);
    };
    window.addEventListener('mouseup', cleanup, { once: true });
    window.addEventListener('pointerup', cleanup, { once: true });
  }, []);
}
