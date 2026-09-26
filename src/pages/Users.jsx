import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import UserFormModal from '../components/UserFormModal'
import EditUserModal from '../components/EditUserModal'
import './Users.css'

const ROLE_META = {
  admin: { label: 'Admin', color: '#E5484D' },
  subadmin: { label: 'Subadmin', color: '#9B7FE0' },
  sales: { label: 'Sales', color: '#5B8DEF' },
  bde: { label: 'BDE', color: '#0EA99A' },
  calling: { label: 'Calling', color: '#F5A623' }
}

export default function Users() {
  const { profile, session } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const canView = ['admin', 'subadmin'].includes(profile?.role)

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setError('')
      setUsers(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (canView) loadUsers()
  }, [canView, loadUsers])

  async function toggleActive(user) {
    setBusyId(user.id)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_active: !user.is_active })
      .eq('id', user.id)

    if (!updateError) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      )
    }
    setBusyId(null)
  }

  if (!canView) {
    return (
      <div>
        <h1>Users</h1>
        <p className="users-subtitle">This page is only available to Admin and Subadmin.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="users-header">
        <div>
          <h1>Users</h1>
          <p className="users-subtitle">Team members who can sign in to the CRM</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ New User</button>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <p className="users-empty">Loading users…</p>
      ) : (
        <div className="users-table-wrap mobile-card-table">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const meta = ROLE_META[u.role] || { label: u.role, color: '#6C7390' }
                const isSelf = u.id === session?.user?.id
                return (
                  <tr key={u.id}>
                    <td data-label="Name">
                      <div className="user-name-cell">
                        {u.full_name}
                        {isSelf && <span className="you-tag">You</span>}
                      </div>
                    </td>
                    <td data-label="Email">{u.email}</td>
                    <td data-label="Role">
                      <span className="role-badge" style={{ '--badge-color': meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={'status-dot' + (u.is_active ? ' active' : ' inactive')}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn-ghost small"
                            onClick={() => setEditingUser(u)}
                          >
                            Edit
                          </button>
                          {!isSelf && (
                            <button
                              className="btn-ghost small"
                              disabled={busyId === u.id}
                              onClick={() => toggleActive(u)}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <UserFormModal
          accessToken={session?.access_token}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            loadUsers()
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          accessToken={session?.access_token}
          onClose={() => setEditingUser(null)}
          onSaved={(updated) => {
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
            setEditingUser(null)
          }}
        />
      )}
    </div>
  )
}
