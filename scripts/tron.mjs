#!/usr/bin/env node
/**
 * TRON control script.
 *
 *   tron start     start the model + app
 *   tron stop      stop both
 *   tron restart   stop then start
 *   tron status    what is running, and is it healthy
 *   tron logs      tail the logs
 *
 * Everything is managed with plain PID files so it works the same in Termux,
 * on a Mac, and over SSH — no init system required.
 */

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const RUN_DIR = path.join(ROOT, ".run");
const LOG_DIR = path.join(ROOT, "logs");

fs.mkdirSync(RUN_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });

// ── Config (override in .env.local or the environment) ────────────────────────

loadEnvFile(path.join(ROOT, ".env.local"));

const CFG = {
  port: process.env.PORT || "3000",
  host: process.env.TRON_HOST || "0.0.0.0",
  llmUrl: process.env.TRON_LLM_URL || "http://127.0.0.1:8080",
  llmBin: process.env.TRON_LLAMA_BIN || "llama-server",
  llmModel: process.env.TRON_LLAMA_MODEL_PATH || "",
  llmPort: process.env.TRON_LLAMA_PORT || "8080",
  llmArgs: process.env.TRON_LLAMA_ARGS || "-c 4096 -t 4 --jinja",
  manageLlm: process.env.TRON_MANAGE_LLAMA !== "false",
};

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

// ── Process helpers ───────────────────────────────────────────────────────────

const pidFile = (name) => path.join(RUN_DIR, `${name}.pid`);
const logFile = (name) => path.join(LOG_DIR, `${name}.log`);

function readPid(name) {
  const f = pidFile(name);
  if (!fs.existsSync(f)) return null;
  const pid = parseInt(fs.readFileSync(f, "utf8").trim(), 10);
  return Number.isFinite(pid) ? pid : null;
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function startProcess(name, command, args, extraEnv = {}) {
  const existing = readPid(name);
  if (isAlive(existing)) {
    console.log(`  ${name} already running (pid ${existing})`);
    return true;
  }

  const out = fs.openSync(logFile(name), "a");
  try {
    const child = spawn(command, args, {
      cwd: ROOT,
      detached: true,
      stdio: ["ignore", out, out],
      env: { ...process.env, ...extraEnv },
      shell: false,
    });
    child.unref();
    fs.writeFileSync(pidFile(name), String(child.pid));
    console.log(`  ${name} started (pid ${child.pid}) → logs/${name}.log`);
    return true;
  } catch (err) {
    console.error(`  ${name} failed to start: ${err.message}`);
    return false;
  }
}

function stopProcess(name) {
  const pid = readPid(name);
  if (!isAlive(pid)) {
    console.log(`  ${name} not running`);
    try { fs.unlinkSync(pidFile(name)); } catch { /* fine */ }
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
    // Give it a moment, then insist.
    const deadline = Date.now() + 5000;
    while (isAlive(pid) && Date.now() < deadline) {
      execSync("sleep 0.2");
    }
    if (isAlive(pid)) process.kill(pid, "SIGKILL");
    console.log(`  ${name} stopped`);
  } catch (err) {
    console.error(`  could not stop ${name}: ${err.message}`);
  }
  try { fs.unlinkSync(pidFile(name)); } catch { /* fine */ }
}

async function httpJson(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function start() {
  console.log("Starting TRON…");

  if (!process.env.TRON_PASSPHRASE) {
    console.error("\n  TRON_PASSPHRASE is not set. Copy .env.example to .env.local first.\n");
    process.exit(1);
  }

  if (CFG.manageLlm) {
    if (!CFG.llmModel) {
      console.log("  llama: TRON_LLAMA_MODEL_PATH not set — assuming llama-server is already running");
    } else {
      startProcess("llama", CFG.llmBin, [
        "-m", CFG.llmModel,
        "--host", "127.0.0.1",
        "--port", CFG.llmPort,
        ...CFG.llmArgs.split(/\s+/).filter(Boolean),
      ]);
    }
  }

  const nextBin = path.join(ROOT, "node_modules", ".bin", "next");
  const hasBuild = fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"));
  if (!hasBuild) {
    console.error("  No production build found. Run: npm run build");
    process.exit(1);
  }

  startProcess("app", nextBin, ["start", "-H", CFG.host, "-p", CFG.port], {
    NODE_ENV: "production",
  });

  console.log("\nWaiting for TRON to answer…");
  for (let i = 0; i < 30; i++) {
    const health = await httpJson(`http://127.0.0.1:${CFG.port}/api/health`);
    if (health) {
      console.log(`\nTRON is up on http://${CFG.host}:${CFG.port}`);
      printHealth(health);
      return;
    }
    execSync("sleep 1");
  }
  console.log("  Still not answering. Check logs/app.log");
}

function stop() {
  console.log("Stopping TRON…");
  stopProcess("app");
  if (CFG.manageLlm) stopProcess("llama");
}

async function status() {
  const appPid = readPid("app");
  const llmPid = readPid("llama");

  console.log("TRON status\n");
  console.log(`  app    ${isAlive(appPid) ? `running (pid ${appPid})` : "stopped"}`);
  console.log(`  llama  ${isAlive(llmPid) ? `running (pid ${llmPid})` : (CFG.manageLlm ? "stopped" : "managed externally")}`);

  const health = await httpJson(`http://127.0.0.1:${CFG.port}/api/health`);
  if (!health) {
    console.log(`\n  No response from http://127.0.0.1:${CFG.port}`);
    return;
  }
  console.log("");
  printHealth(health);
}

function printHealth(h) {
  console.log(`  database  ${h.database.ok ? "ok" : "FAILED"} — ${h.database.detail}`);
  console.log(`            ${h.database.documents} documents, ${h.database.memories} memories`);
  console.log(`  model     ${h.model.ok ? "ok" : "unreachable"} — ${h.model.detail}`);
  console.log(`  uptime    ${h.uptimeSeconds}s`);
}

function logs() {
  const which = process.argv[3] === "llama" ? "llama" : "app";
  const f = logFile(which);
  if (!fs.existsSync(f)) return console.log(`No ${which} log yet.`);
  spawn("tail", ["-f", "-n", "80", f], { stdio: "inherit" });
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

const cmd = process.argv[2];

switch (cmd) {
  case "start":
    await start();
    break;
  case "stop":
    stop();
    break;
  case "restart":
    stop();
    execSync("sleep 1");
    await start();
    break;
  case "status":
    await status();
    break;
  case "logs":
    logs();
    break;
  default:
    console.log(`TRON — private personal AI

  tron start      start the model and the app
  tron stop       stop everything
  tron restart    restart everything
  tron status     show what is running and whether it is healthy
  tron logs       tail the app log  (tron logs llama for the model)
`);
}
