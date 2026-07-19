import { useEffect, useState } from 'react'
import { Card } from '@shared/components/ui/Card'
import { Badge } from '@shared/components/ui/Badge'
import { Avatar } from '@shared/components/ui/Avatar'
import { Button } from '@shared/components/ui/Button'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { getAllUsers, updateUserRole } from '@core/supabase/queries/admin'
import { formatDate } from '@core/utils/formatters'
import { useToast } from '@core/contexts/ToastContext'
import type { ProfileRow } from '@core/types'

export function AdminUsersPage() {
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  async function load() {
    setLoading(true)
    const { data } = await getAllUsers()
    setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleRole(user: ProfileRow) {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    const { error } = await updateUserRole(user.id, newRole)
    if (error) {
      showToast('Could not update role.', 'error')
      return
    }
    showToast(`${user.full_name ?? user.email} is now ${newRole}.`, 'success')
    load()
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Users</h1>
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : users.length === 0 ? (
        <EmptyState title="No users yet" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Mobile</th>
                <th className="p-4">Role</th>
                <th className="p-4">Joined</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="flex items-center gap-3 p-4">
                    <Avatar src={user.avatar_url} name={user.full_name} size={32} />
                    <div>
                      <p className="font-medium">{user.full_name ?? 'Unnamed'}</p>
                      <p className="text-slate-500">{user.email}</p>
                    </div>
                  </td>
                  <td className="p-4">{user.mobile ?? '—'}</td>
                  <td className="p-4">
                    <Badge tone={user.role === 'admin' ? 'info' : 'default'}>{user.role}</Badge>
                  </td>
                  <td className="p-4">{formatDate(user.created_at)}</td>
                  <td className="p-4">
                    <Button variant="secondary" onClick={() => toggleRole(user)}>
                      {user.role === 'admin' ? 'Revoke admin' : 'Make admin'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
