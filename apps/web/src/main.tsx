import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/app/AppShell'
import { RequireAuth, RequireRole } from '@/app/guards'
import { AuthProvider } from '@/features/auth/hooks/useAuth'
import { BracketsPage } from '@/features/brackets/ui/BracketsPage'
import { LoginPage } from '@/features/auth/ui/LoginPage'
import { ProfilePage } from '@/features/profile/ui/ProfilePage'
import { RadarPage } from '@/features/radar/ui/RadarPage'
import { SorteioPage } from '@/features/sorteio/ui/SorteioPage'
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
            {/* Radar: Colaborador não tem acesso (PRD seção 3.2.5). */}
            <Route
              path="/radar"
              element={
                <RequireRole roles={['ADMIN', 'GESTOR']}>
                  <RadarPage />
                </RequireRole>
              }
            />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/sorteio" element={<SorteioPage />} />
            <Route path="/brackets" element={<BracketsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/times" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
