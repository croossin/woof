import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadState } from "./state";

const SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

const STATUSLINE_BLOCK = { type: "command", command: "woof statusline", padding: 0 };

/** Add woof to the user's Claude Code statusline in ~/.claude/settings.json. */
export function installStatusline(): void {
  const name = loadState()?.name ?? "your dog";

  let settings: Record<string, unknown> = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
    } catch {
      console.log(
        `\n  ${yellow("Couldn't parse")} ${SETTINGS_PATH}.` +
          `\n  Add this to it by hand instead:\n` +
          `\n    "statusLine": { "type": "command", "command": "woof statusline" }\n`
      );
      return;
    }
  }

  const existing = settings.statusLine as { command?: string } | undefined;
  if (existing?.command?.includes("woof")) {
    console.log(`\n  🐶 ${name} is already living in your Claude Code statusline.\n`);
    return;
  }
  if (existing) {
    console.log(
      `\n  ${yellow("You already have a statusLine configured")} (${dim(
        existing.command ?? "custom"
      )}).` +
        `\n  Leaving it alone. To use woof instead, set its command to ${cyan(
          "woof statusline"
        )}.\n`
    );
    return;
  }

  settings.statusLine = STATUSLINE_BLOCK;
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  const tmp = SETTINGS_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + "\n");
  fs.renameSync(tmp, SETTINGS_PATH);

  console.log(
    `\n  🐶 ${bold(`${name} moved into your Claude Code statusline!`)}` +
      `\n  ${dim(`Updated ${SETTINGS_PATH}`)}` +
      `\n\n  Start a new Claude Code session (or reload) to see them appear.` +
      `\n  ${dim("Remove the \"statusLine\" block from that file to evict them.")}\n`
  );
}
