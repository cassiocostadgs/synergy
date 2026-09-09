import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/app/AppShell'
import { RequireAuth, RequireRole } from '@/app/guards'
import { AuthProvider } from '@/features/auth/hooks/useAuth'
import { LoginPage } from '@/features/auth/ui/LoginPage'
import { ProfilePage } from '@/features/profile/ui/ProfilePage'
import { TeamMembersPage } from '@/features/teams/ui/TeamMembersPage'
import { TeamsPage } from '@/features/teams/ui/TeamsPage'
import { UsersPage } from '@/features/users/ui/UsersPage'

import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/times" replace />} />
            <Route path="/times" element={<TeamsPage />} />
            <Route path="/times/:teamId" element={<TeamMembersPage />} />
            <Route
              path="/usuarios"
              element={
                <RequireRole roles={['ADMIN', 'GESTOR']}>
                  <UsersPage />
                </RequireRole>
              }
            />
            <Route path="/perfil" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/times" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
