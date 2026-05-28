#!/usr/bin/env node
/**
 * Cross-platform wrapper that ensures the console encoding is UTF-8 before
 * spawning a child command. On Windows, Next.js' build output uses Unicode
 * box-drawing characters (├ │ └ ƒ ○) that render as mojibake (Γö£ ╞Æ Γöö)
 * when the console is on the default cp1252 code page. Switching to
 * code page 65001 (UTF-8) makes the build summary readable.
 *
 * Usage: node scripts/with-utf8.js <cmd> [...args]
 */
const { spawn, execSync } = require("node:child_process");

if (process.platform === "win32") {
  try {
    // `chcp` updates the code page of the parent console window, which is
    // inherited by all child processes attached to it. Suppress its output.
    execSync("chcp 65001 >nul", { stdio: "ignore", shell: true });
  } catch {
    // chcp is best-effort; ignore failures and continue.
  }
}

const [, , cmd, ...args] = process.argv;
if (!cmd) {
  console.error("with-utf8: missing command");
  process.exit(2);
}

const child = spawn(cmd, args, { stdio: "inherit", shell: true });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
