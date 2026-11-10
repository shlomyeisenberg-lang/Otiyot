// Renders docs/progress.json into docs/PROGRESS.md (a readable page for GitHub).
// Plain Node, no dependencies. Run it with: node scripts/render-progress.mjs
// docs/PROGRESS.md is generated: never edit it by hand.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = join(root, "docs", "progress.json");
const roadmapPath = join(root, "docs", "ROADMAP.md");
const outPath = join(root, "docs", "PROGRESS.md");

let data;
try {
  data = JSON.parse(readFileSync(jsonPath, "utf8"));
} catch (error) {
  console.error(`docs/progress.json is not valid JSON: ${error.message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const list = (value) => (Array.isArray(value) ? value : []);
const text = (value) => (typeof value === "string" ? value.trim() : "");

const STATUS = {
  done: { icon: "✅", label: "Done" },
  in_progress: { icon: "🛠️", label: "In progress" },
  blocked: { icon: "⛔", label: "Blocked" },
  pending: { icon: "⬜", label: "Pending" },
};
const statusOf = (task) => STATUS[task?.status] ?? STATUS.pending;

// A code fence longer than any run of backticks inside the text, so a prompt that
// contains ``` can never break out of its block. Every prompt gets its own block,
// which makes GitHub show a copy button.
function fenced(content) {
  const body = String(content).replace(/\s+$/, "");
  const runs = body.match(/`+/g) ?? [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}text\n${body}\n${fence}`;
}

const prNumber = (url) => /\/pull\/(\d+)/.exec(url ?? "")?.[1];
const prLink = (url) => {
  const link = text(url);
  if (!link) return "";
  const number = prNumber(link);
  return number ? `[PR #${number}](${link})` : link;
};

// "T12" -> 12, so tasks are always shown in order whatever order the JSON has.
const taskNumber = (id) => Number(/\d+/.exec(id)?.[0] ?? 0);

// Task titles come from the ROADMAP headings ("### [x] T01 · Project setup"). If the
// file can't be read the page still renders, with the ids alone.
const titles = {};
try {
  for (const line of readFileSync(roadmapPath, "utf8").split("\n")) {
    const match = /^###\s+\[[ xX]\]\s+(T\d+)\s+·\s+(.+?)\s*$/.exec(line);
    if (match) titles[match[1]] = match[2];
  }
} catch {
  // titles stay empty
}

const heading = (id) => (titles[id] ? `${id} · ${titles[id]}` : id);

const taskIds = Object.keys(data.tasks ?? {}).sort((a, b) => taskNumber(a) - taskNumber(b));

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function renderManualStep(step, index) {
  const lines = [];
  const mark = step.done ? "✅ done" : "⬜ open";
  lines.push(`${index}. **${text(step.title) || "Manual step"}** (${mark})`);
  const details = text(step.details);
  if (details) lines.push("", `   ${details.replace(/\n/g, "\n   ")}`);
  const browserPrompt = text(step.browser_prompt);
  if (browserPrompt) {
    lines.push("", "   Prompt for Claude in Chrome:", "");
    lines.push(
      ...fenced(browserPrompt)
        .split("\n")
        .map((line) => `   ${line}`),
    );
  }
  return lines.join("\n");
}

function renderTask(id, task) {
  const status = statusOf(task);
  const out = [`### ${status.icon} ${heading(id)}`, ""];
  const meta = [`**Status:** ${status.label}`];
  if (text(task.finished)) meta.push(`**Finished:** ${task.finished}`);
  if (text(task.pr)) meta.push(`**Pull request:** ${prLink(task.pr)}`);
  out.push(meta.join(" · "), "");

  const summary = text(task.summary);
  const changes = list(task.changes);
  const decisions = list(task.decisions);
  const manual = list(task.manual_steps);
  const todo = list(task.todo);
  const notes = text(task.notes);

  if (
    !summary &&
    !changes.length &&
    !decisions.length &&
    !manual.length &&
    !todo.length &&
    !notes
  ) {
    out.push(status.label === "Pending" ? "_Not started._" : "_No details yet._", "");
    return out.join("\n");
  }

  if (summary) out.push(summary, "");
  if (changes.length) {
    out.push("**What changed**", "", ...changes.map((item) => `- ${item}`), "");
  }
  if (decisions.length) {
    out.push(
      "**Decisions**",
      "",
      ...decisions.map((item) => `- **${text(item.decision)}** — ${text(item.why)}`),
      "",
    );
  }
  if (manual.length) {
    out.push("**Manual steps**", "", ...manual.map((step, i) => renderManualStep(step, i + 1)), "");
  }
  if (todo.length) {
    out.push("**To do**", "", ...todo.map((item) => `- [ ] ${item}`), "");
  }
  if (notes) out.push("**Notes**", "", notes, "");
  return out.join("\n");
}

function renderWaiting() {
  const open = [];
  for (const id of taskIds) {
    list(data.tasks[id]?.manual_steps).forEach((step) => {
      if (!step.done) open.push({ id, step });
    });
  }
  const out = ["## Waiting for me", ""];
  if (!open.length) {
    out.push("Nothing is waiting. Every manual step is done. 🎉", "");
    return { open, markdown: out.join("\n") };
  }
  out.push(
    `${open.length} manual step${open.length === 1 ? "" : "s"} only you can do. Paste each prompt into Claude in Chrome, and tell the AI when a step is finished.`,
    "",
  );
  for (const { id, step } of open) {
    out.push(`### ⬜ ${text(step.title) || "Manual step"} — ${heading(id)}`, "");
    const details = text(step.details);
    if (details) out.push(details, "");
    const browserPrompt = text(step.browser_prompt);
    if (browserPrompt) out.push("Prompt for Claude in Chrome:", "", fenced(browserPrompt), "");
  }
  return { open, markdown: out.join("\n") };
}

function renderHistory() {
  const out = ["## History", "", "Work done before or outside the numbered tasks.", ""];
  const history = list(data.history);
  if (!history.length) {
    out.push("_Nothing yet._", "");
    return out.join("\n");
  }
  for (const entry of history) {
    const where = text(entry.where);
    out.push(`- **${text(entry.date)}** — ${text(entry.what)}${where ? ` (${where})` : ""}`);
  }
  out.push("");
  return out.join("\n");
}

function renderFeatureIdeas() {
  const out = ["## Feature ideas", ""];
  const ideas = list(data.feature_ideas);
  if (!ideas.length) {
    out.push("_No ideas yet._", "");
    return out.join("\n");
  }
  for (const idea of ideas) {
    const from = text(idea.from);
    out.push(`### 💡 ${text(idea.title) || "Idea"}${from ? ` (from ${from})` : ""}`, "");
    const meta = [];
    if (text(idea.status)) meta.push(`**Status:** ${idea.status}`);
    if (text(idea.model)) meta.push(`**Model:** ${idea.model}`);
    if (text(idea.effort)) meta.push(`**Effort:** ${idea.effort}`);
    if (meta.length) out.push(meta.join(" · "), "");
    if (text(idea.why)) out.push(text(idea.why), "");
    if (text(idea.prompt)) out.push("Build prompt:", "", fenced(idea.prompt), "");
  }
  return out.join("\n");
}

function renderNotes() {
  const out = ["## Notes", ""];
  const notes = list(data.notes);
  if (!notes.length) {
    out.push("_No notes yet._", "");
    return out.join("\n");
  }
  for (const note of notes) {
    const from = text(note.from);
    out.push(`- **${text(note.date)}**${from ? ` (${from})` : ""} — ${text(note.text)}`);
  }
  out.push("");
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const counts = { done: 0, in_progress: 0, blocked: 0, pending: 0 };
for (const id of taskIds) {
  const key = Object.keys(STATUS).find((name) => STATUS[name] === statusOf(data.tasks[id]));
  counts[key] += 1;
}

const waiting = renderWaiting();
const ideas = list(data.feature_ideas);
const total = taskIds.length;

const page = [];
page.push(
  "<!-- Generated by scripts/render-progress.mjs from docs/progress.json. Do not edit by hand. -->",
  "",
  "# Otiyot — Progress",
  "",
  `_Last updated ${text(data.updated) || "unknown"}. This page is generated from \`docs/progress.json\`; to change it, edit the JSON and run \`node scripts/render-progress.mjs\`._`,
  "",
  "## Summary",
  "",
  `- ✅ **${counts.done}** of **${total}** tasks done`,
  `- 🛠️ ${counts.in_progress} in progress · ⛔ ${counts.blocked} blocked · ⬜ ${counts.pending} pending`,
  `- ⬜ **${waiting.open.length}** manual step${waiting.open.length === 1 ? "" : "s"} waiting for you`,
  `- 💡 ${ideas.filter((idea) => (idea.status ?? "idea") === "idea").length} feature idea${ideas.length === 1 ? "" : "s"} open`,
  "",
  waiting.markdown,
  renderHistory(),
  "## Task overview",
  "",
  ...taskIds.map((id) => {
    const task = data.tasks[id];
    const status = statusOf(task);
    const extra = [];
    if (text(task.finished)) extra.push(task.finished);
    if (text(task.pr)) extra.push(prLink(task.pr));
    return `- ${status.icon} ${heading(id)}${extra.length ? ` — ${extra.join(" · ")}` : ""}`;
  }),
  "",
  "## Tasks",
  "",
  ...taskIds.flatMap((id) => [renderTask(id, data.tasks[id])]),
  renderFeatureIdeas(),
  renderNotes(),
);

const markdown = page.join("\n").replace(/\s+$/, "") + "\n";
writeFileSync(outPath, markdown);
console.log(
  `Wrote docs/PROGRESS.md: ${counts.done}/${total} tasks done, ${waiting.open.length} manual steps waiting.`,
);
