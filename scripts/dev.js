import { spawn } from 'node:child_process'

// Backend (4000) va frontend (5173) ni birga ishga tushiradi. Ctrl+C ikkalasini to'xtatadi.
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const apps = [
  { name: 'api', color: '\x1b[34m', dir: 'backend' },
  { name: 'web', color: '\x1b[32m', dir: 'frontend' },
]

const children = apps.map(({ name, color, dir }) => {
  const child = spawn(npm, ['run', 'dev'], { cwd: new URL(`../${dir}/`, import.meta.url), shell: process.platform === 'win32' })
  const prefix = `${color}[${name}]\x1b[0m `
  const pipe = (stream, out) =>
    stream.on('data', (chunk) => {
      for (const line of chunk.toString().split('\n')) if (line.trim()) out.write(`${prefix}${line}\n`)
    })
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)
  child.on('exit', (code) => {
    console.log(`${prefix}to'xtadi (${code ?? 0})`)
    stop()
  })
  return child
})

let stopping = false
function stop() {
  if (stopping) return
  stopping = true
  for (const child of children) if (!child.killed) child.kill()
  setTimeout(() => process.exit(0), 300)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
