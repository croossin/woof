import { DailyActivity, PetState } from "./state";

function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return arr[h % arr.length];
}

export function journalLine(day: string, a: DailyActivity, name: string): string {
  const busy = a.commits + a.prsMerged * 3 + a.reviews * 2;
  const claudey = a.claudeTokens > 20_000;

  if (a.prsMerged > 0) {
    return pick(
      [
        `We merged ${a.prsMerged === 1 ? "a pull request" : `${a.prsMerged} pull requests`} today. ${name} did zoomies around the terminal.`,
        `Merge day. ${name}'s tail would not stop.`,
        `Something we worked on is out in the world now. ${name} is proud of you.`,
      ],
      day + "pr"
    );
  }
  if (a.reviews > 0 && a.commits === 0) {
    return pick(
      [
        `No commits today, but you helped someone else's work along. ${name} thinks that counts double.`,
        `A day of reviews. Quiet, generous work. ${name} approves.`,
      ],
      day + "rev"
    );
  }
  if (busy >= 8) {
    return pick(
      [
        `A big day — ${a.commits} commits fetched and buried safely in the yard. ${name} is full and sleepy.`,
        `${a.commits} commits! ${name} could barely keep up with all the fetching.`,
      ],
      day + "big"
    );
  }
  if (a.commits > 0) {
    return pick(
      [
        `A steady day. ${a.commits === 1 ? "One good commit" : `${a.commits} commits`}, and time together.`,
        `We got some work done today. Nothing dramatic. Those are good days too.`,
      ],
      day + "steady"
    );
  }
  if (claudey) {
    return pick(
      [
        `No commits today, but we talked a lot. ${name} likes the company.`,
        `A thinking day, mostly. ${name} kept your feet warm while you worked things out.`,
      ],
      day + "claude"
    );
  }
  return pick(
    [
      `A quiet day. ${name} watched the cursor blink for a while, then napped.`,
      `Nothing much happened today. ${name} doesn't mind.`,
    ],
    day + "quiet"
  );
}

export function recentJournal(state: PetState, days = 7): Array<{ day: string; line: string }> {
  const keys = Object.keys(state.dailyLog).sort().slice(-days);
  return keys.map((day) => ({
    day,
    line: journalLine(day, state.dailyLog[day], state.name),
  }));
}
