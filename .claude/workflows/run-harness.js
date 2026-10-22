#!/usr/bin/env node
// Minimal runner for the phase()/agent() pseudocode in spdd-harness.js.
//
// Usage: node .claude/workflows/run-harness.js <storyId>
//
// phase(name)  — logs a phase header, no side effects.
// agent(prompt) — runs `claude -p` with the given prompt, full default
//                 tools, no permission prompts (the whole point of an
//                 unattended end-to-end delivery workflow), streaming its
//                 output to this process's stdout as it runs.

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const storyId = process.argv[2]
if (!storyId) {
  console.error('Usage: node run-harness.js <storyId>')
  process.exit(1)
}

function phase(name) {
  console.log(`\n${'='.repeat(72)}\nPHASE: ${name}\n${'='.repeat(72)}`)
}

function agent(prompt) {
  console.log(`\n--- agent: ${prompt} ---`)
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'claude',
      ['-p', prompt, '--dangerously-skip-permissions', '--output-format', 'text'],
      { stdio: ['ignore', 'inherit', 'inherit'] }
    )

    proc.on('error', (err) => {
      reject(new Error(`Failed to run "claude" — is Claude Code on PATH? ${err.message}`))
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`agent step exited with code ${code}: ${prompt}`))
        return
      }
      resolve()
    })
  })
}

async function main() {
  const scriptPath = path.resolve(__dirname, 'spdd-harness.js')
  const source = fs.readFileSync(scriptPath, 'utf-8')

  // spdd-harness.js is top-level `await phase(...)` / `await agent(...)`
  // statements, written to be read as a lab illustration, not a module —
  // wrap it in an async function body so `await` is valid, and run it in
  // this process with phase/agent/storyId injected as the only globals it
  // needs.
  const wrapped = `(async () => {\n${source}\n})()`
  const context = { phase, agent, storyId, console }
  vm.createContext(context)
  await vm.runInContext(wrapped, context, { filename: scriptPath })
}

main().catch((err) => {
  console.error(`\n${err.message}\n`)
  process.exit(1)
})
