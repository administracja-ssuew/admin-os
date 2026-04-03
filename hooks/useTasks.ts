'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Task, AppUser, Department } from '../types'

interface UseTasksResult {
  tasks: Task[]
  users: AppUser[]
  departments: Department[]
  projects: any[]
  cases: any[]
  loading: boolean
  refetch: () => Promise<void>
}

export function useTasks(): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const [tasksRes, usersRes, projectsRes, deptsRes, casesRes] = await Promise.all([
      supabase.from('tasks')
        .select('*, owner:users!tasks_owner_id_fkey(first_name, last_name), projects(name), departments(name), cases(title, case_number)')
        .order('created_at', { ascending: false }),
      supabase.from('users').select('*').order('first_name', { ascending: true }),
      supabase.from('projects').select('*').order('name', { ascending: true }),
      supabase.from('departments').select('*').order('name', { ascending: true }),
      supabase.from('cases').select('*').order('created_at', { ascending: false }),
    ])

    if (tasksRes.data) setTasks(tasksRes.data)
    if (usersRes.data) setUsers(usersRes.data)
    if (projectsRes.data) setProjects(projectsRes.data)
    if (deptsRes.data) setDepartments(deptsRes.data)
    if (casesRes.data) setCases(casesRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  return { tasks, users, departments, projects, cases, loading, refetch: fetchData }
}
