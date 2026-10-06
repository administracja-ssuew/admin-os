interface BoardTask {
  status: string
  deadline: string | null
  owner_id: string | null
  department_id: string | null
  is_zarzad: boolean
}

interface BoardUser {
  id: string
  department_id: string | null
}

/** YYYY-MM-DD in the browser's time zone; toISOString() would shift late-evening dates to UTC. */
export function localDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Deadlines are calendar dates, so "within 24 h" means due today or tomorrow; overdue tasks count too. */
export function isUrgentTask(task: BoardTask, today: string): boolean {
  if (task.status === 'done' || !task.deadline) return false
  const [y, m, d] = today.split('-').map(Number)
  const tomorrow = localDateString(new Date(y, m - 1, d + 1))
  return task.deadline.slice(0, 10) <= tomorrow
}

/** Same rule as the general view of the task board (app/tasks). Display filter only — RLS still applies. */
export function isVisibleOnBoard(task: BoardTask, user: BoardUser | null, isAdmin: boolean): boolean {
  if (task.is_zarzad) return false
  if (isAdmin) return true
  const isMine = !!user && task.owner_id === user.id
  const isMyDept = !!user && task.department_id === user.department_id
  const isGlobal = !task.department_id && !task.owner_id
  return isMine || isMyDept || isGlobal
}

export function sortTasksForOverview<T extends BoardTask>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const doneDiff = Number(a.status === 'done') - Number(b.status === 'done')
    if (doneDiff !== 0) return doneDiff
    if (a.deadline === b.deadline) return 0
    if (!a.deadline) return 1
    if (!b.deadline) return -1
    return a.deadline < b.deadline ? -1 : 1
  })
}
