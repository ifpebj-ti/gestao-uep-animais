#!/usr/bin/env node
/**
 * Cria as issues do Backlog do Produto (docs/BACKLOG.md) no GitHub, com as
 * labels de epico e prioridade, usando o GitHub CLI (gh).
 *
 * Pre-requisitos:
 *   1. GitHub CLI instalado (https://cli.github.com/)
 *   2. Autenticado:  gh auth login
 *   3. Rodar este script de dentro do repositorio (ou informar --repo dono/repo)
 *
 * Uso:
 *   node scripts/create-issues.js
 *   node scripts/create-issues.js --repo ifpebj-ti/gestao-uep-animais
 *   node scripts/create-issues.js --dry-run   (so mostra o que faria, nao cria nada)
 *
 * E seguro rodar mais de uma vez: antes de criar, verifica se ja existe uma
 * issue aberta ou fechada com o mesmo titulo e pula (evita duplicar).
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const repoArgIndex = args.indexOf("--repo");
const repo = repoArgIndex !== -1 ? args[repoArgIndex + 1] : null;

const issuesPath = path.join(__dirname, "backlog-issues.json");
const issues = JSON.parse(fs.readFileSync(issuesPath, "utf-8"));

const EPIC_COLORS = {
  "epic:autenticacao": "1d76db",
  "epic:ueps": "0e8a16",
  "epic:rebanho": "5319e7",
  "epic:estoque": "b60205",
  "epic:notas-fiscais": "fbca04",
  "epic:relatorios": "c2e0c6",
  "epic:infra": "d93f0b",
  "epic:seguranca": "e11d21",
  "epic:docs": "bfdadc",
};
const PRIO_COLORS = {
  "prioridade:alta": "e11d21",
  "prioridade:media": "fbca04",
  "prioridade:baixa": "c2e0c6",
};

function gh(cmdArgs) {
  const finalArgs = repo ? [...cmdArgs, "--repo", repo] : cmdArgs;
  return execFileSync("gh", finalArgs, { encoding: "utf-8" });
}

function ensureLabel(name, color, description) {
  if (dryRun) {
    console.log(`[dry-run] label: ${name}`);
    return;
  }
  try {
    gh(["label", "create", name, "--color", color, "--description", description, "--force"]);
    console.log(`label ok: ${name}`);
  } catch (err) {
    console.error(`falha ao criar label ${name}:`, err.message);
  }
}

function issueExists(title) {
  try {
    const out = gh([
      "issue", "list",
      "--search", `"${title}" in:title`,
      "--state", "all",
      "--json", "title",
      "--limit", "5",
    ]);
    const list = JSON.parse(out);
    return list.some((i) => i.title === title);
  } catch (err) {
    console.error("falha ao checar issue existente:", err.message);
    return false;
  }
}

function createIssue(issue) {
  const { title, body, labels } = issue;

  if (issueExists(title)) {
    console.log(`ja existe, pulando: ${title}`);
    return;
  }

  if (dryRun) {
    console.log(`[dry-run] issue: ${title} [${labels.join(", ")}]`);
    return;
  }

  const cmdArgs = ["issue", "create", "--title", title, "--body", body];
  for (const label of labels) {
    cmdArgs.push("--label", label);
  }

  try {
    const out = gh(cmdArgs);
    console.log(`criada: ${title} -> ${out.trim()}`);
  } catch (err) {
    console.error(`falha ao criar issue "${title}":`, err.message);
  }
}

function main() {
  console.log(`Autenticacao gh:`);
  try {
    console.log(gh(["auth", "status"]));
  } catch (err) {
    console.error("gh nao autenticado. Rode: gh auth login");
    process.exit(1);
  }

  console.log("\n== Criando labels de epico ==");
  for (const [name, color] of Object.entries(EPIC_COLORS)) {
    ensureLabel(name, color, "Epico do backlog do produto (docs/BACKLOG.md)");
  }

  console.log("\n== Criando labels de prioridade ==");
  for (const [name, color] of Object.entries(PRIO_COLORS)) {
    ensureLabel(name, color, "Prioridade do backlog do produto (docs/BACKLOG.md)");
  }

  console.log(`\n== Criando ${issues.length} issues ==`);
  for (const issue of issues) {
    createIssue(issue);
  }

  console.log("\nConcluido. Va em Projects no GitHub e adicione as issues criadas ao board.");
}

main();
