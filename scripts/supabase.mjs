// Supabase CLI for AdminOS: `npm run sb -- <args>`.
// Reads SUPABASE_ACCESS_TOKEN (and optionally SUPABASE_DB_PASSWORD) from .env.supabase,
// so the AdminOS token does not replace a global `supabase login` for another account.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const CLI = 'supabase@2.120.0'
const envFile = new URL('../.env.supabase', import.meta.url)
const env = { ...process.env }

if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (match && match[2]) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
} else {
  console.error('Brak .env.supabase — skopiuj .env.supabase.example i wpisz token AdminOS.')
}

// Run npx through node (no shell), so arguments such as SQL with spaces are passed intact on Windows.
const npmCli = process.env.npm_execpath
const npxCli = npmCli && join(dirname(npmCli), 'npx-cli.js')
const args = ['-y', CLI, ...process.argv.slice(2)]
const result = npxCli && existsSync(npxCli)
  ? spawnSync(process.execPath, [npxCli, ...args], { stdio: 'inherit', env })
  : spawnSync('npx', args, { stdio: 'inherit', env })
process.exit(result.status ?? 1)
