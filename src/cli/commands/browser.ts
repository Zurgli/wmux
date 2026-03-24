import { sendRequest } from '../client';
import { printResult, printError } from '../utils';
import type { RpcResponse } from '../../shared/rpc';

const BROWSER_HELP = `
wmux browser — Browser Commands

USAGE
  wmux browser <subcommand> [args]

SUBCOMMANDS
  navigate <url>                  Navigate the active browser surface to a URL
  close                           Close the browser panel
  session start [--profile <name>]  Start a browser session
  session stop                      Stop the active browser session
  session status                    Show active session status
  session list                      List available profiles

EXAMPLES
  wmux browser navigate "https://example.com"
  wmux browser close
  wmux browser session start --profile login
  wmux browser session status
  wmux browser session list
`.trimStart();

export async function handleBrowser(
  args: string[],
  jsonMode: boolean,
): Promise<void> {
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === '--help' || sub === '-h') {
    process.stdout.write(BROWSER_HELP);
    process.exit(0);
  }

  let response: RpcResponse;

  switch (sub) {
    // ── browser navigate <url> ───────────────────────────────────────────────
    case 'navigate': {
      const url = rest[0];
      if (!url) {
        console.error('Error: browser navigate requires <url>');
        process.exit(1);
      }
      response = await sendRequest('browser.navigate', { url });
      if (jsonMode) {
        printResult(response);
      } else {
        if (!response.ok) { printError(response); return; }
        console.log(`Navigated to: ${url}`);
      }
      break;
    }

    // ── browser close ────────────────────────────────────────────────────────
    case 'close': {
      response = await sendRequest('browser.close', {});
      if (jsonMode) {
        printResult(response);
      } else {
        if (!response.ok) { printError(response); return; }
        console.log('Browser panel closed.');
      }
      break;
    }

    // ── browser session <action> ─────────────────────────────────────────────
    case 'session': {
      const action = rest[0];
      if (!action || action === '--help' || action === '-h') {
        console.log('Usage: wmux browser session <start|stop|status|list>');
        process.exit(0);
      }

      switch (action) {
        case 'start': {
          const profileIdx = rest.indexOf('--profile');
          const profile = profileIdx !== -1 ? rest[profileIdx + 1] : undefined;
          const params: Record<string, unknown> = {};
          if (profile) params['profile'] = profile;
          response = await sendRequest('browser.session.start', params);
          if (jsonMode) {
            printResult(response);
          } else {
            if (!response.ok) { printError(response); return; }
            const r = response.result as Record<string, unknown>;
            console.log(`Session started with profile: ${r['profile'] ?? 'default'}`);
          }
          break;
        }
        case 'stop': {
          response = await sendRequest('browser.session.stop', {});
          if (jsonMode) {
            printResult(response);
          } else {
            if (!response.ok) { printError(response); return; }
            console.log('Session stopped.');
          }
          break;
        }
        case 'status': {
          response = await sendRequest('browser.session.status', {});
          if (jsonMode) {
            printResult(response);
          } else {
            if (!response.ok) { printError(response); return; }
            const r = response.result as Record<string, unknown>;
            console.log(`Active profile: ${r['profile'] ?? 'none'}`);
            console.log(`CDP port: ${r['port'] ?? 'none'}`);
          }
          break;
        }
        case 'list': {
          response = await sendRequest('browser.session.list', {});
          if (jsonMode) {
            printResult(response);
          } else {
            if (!response.ok) { printError(response); return; }
            const profiles = (response.result as Record<string, unknown>)['profiles'] as Array<Record<string, unknown>>;
            if (!profiles || profiles.length === 0) {
              console.log('No profiles found.');
            } else {
              for (const p of profiles) {
                console.log(`  ${p['name']}  (partition: ${p['partition']}, persistent: ${p['persistent']})`);
              }
            }
          }
          break;
        }
        default:
          console.error(`Unknown session action: "${action}". Use start, stop, status, or list.`);
          process.exit(1);
      }
      break;
    }

    default:
      console.error(`Unknown browser subcommand: "${sub}". Run 'wmux browser --help' for usage.`);
      process.exit(1);
  }
}
