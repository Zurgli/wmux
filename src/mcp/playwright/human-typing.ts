import type { Page } from 'playwright-core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HumanTypingOptions {
  /** Minimum inter-keystroke delay in ms (default 50) */
  minDelay?: number;
  /** Maximum inter-keystroke delay in ms (default 150) */
  maxDelay?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DEFAULT_MIN_DELAY = 50;
const DEFAULT_MAX_DELAY = 150;

function randomDelay(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an array of per-character delay values (in ms) for the given
 * text.  This mirrors `HumanBehavior.generateTypingSchedule()` from the
 * main process but is independent of that class.
 */
export function generateDelaySchedule(
  text: string,
  options?: HumanTypingOptions,
): number[] {
  const min = options?.minDelay ?? DEFAULT_MIN_DELAY;
  const max = options?.maxDelay ?? DEFAULT_MAX_DELAY;

  return Array.from({ length: text.length }, () => randomDelay(min, max));
}

/**
 * Type `text` into the element identified by `selector` with randomised
 * inter-keystroke delays that mimic human typing.
 *
 * Each character is pressed individually via `page.keyboard.press()` with
 * a random pause between `minDelay` and `maxDelay` milliseconds.
 *
 * If `selector` is provided the element is clicked first to ensure focus.
 */
export async function typeHumanlike(
  page: Page,
  selector: string,
  text: string,
  options?: HumanTypingOptions,
): Promise<void> {
  // Focus the target element
  if (selector) {
    await page.click(selector);
  }

  const delays = generateDelaySchedule(text, options);

  for (let i = 0; i < text.length; i++) {
    await page.keyboard.press(text[i]);
    await sleep(delays[i]);
  }
}
