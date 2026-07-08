import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { PetState } from "../state";
import { FeedEvent } from "../sim";

const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");

/**
 * Scan Claude Code session transcripts for assistant output tokens produced
 * since the last scan. Everything is local — we just read the JSONL files.
 */
export async function scanClaudeTokens(state: PetState, now: Date): Promise<FeedEvent[]> {
  const since = new Date(state.lastClaudeScan ?? state.hatchedAt);
  let tokens = 0;

  let projectDirs: string[] = [];
  try {
    projectDirs = fs
      .readdirSync(PROJECTS_DIR)
      .map((d) => path.join(PROJECTS_DIR, d))
      .filter((p) => {
        try {
          return fs.statSync(p).isDirectory();
        } catch {
          return false;
        }
      });
  } catch {
    return []; // no Claude Code on this machine — that's fine
  }

  for (const dir of projectDirs) {
    let files: string[] = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const f of files) {
      const full = path.join(dir, f);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.mtimeMs <= since.getTime()) continue; // untouched since last scan
      let raw: string;
      try {
        raw = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      for (const line of raw.split("\n")) {
        if (!line) continue;
        // Cheap pre-filter before paying for JSON.parse on every line.
        if (!line.includes('"output_tokens"')) continue;
        try {
          const obj = JSON.parse(line);
          const ts = obj?.timestamp ? new Date(obj.timestamp) : null;
          if (!ts || ts.getTime() <= since.getTime()) continue;
          const usage = obj?.message?.usage;
          if (usage?.output_tokens) tokens += usage.output_tokens;
        } catch {
          // partial line mid-write — skip
        }
      }
    }
  }

  state.lastClaudeScan = now.toISOString();
  if (tokens <= 0) return [];
  return [{ kind: "claude-tokens", count: tokens, when: now }];
}
