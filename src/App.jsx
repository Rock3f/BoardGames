import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ActivePlayProvider } from './context/ActivePlayContext'
import { ToastProvider } from './components/ui/Toast'
import { Spinner } from './components/ui/Spinner'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import CollectionPage from './pages/collection/CollectionPage'
import CatalogPage from './pages/catalog/CatalogPage'
import PlaysPage from './pages/plays/PlaysPage'
import ChampionshipsPage from './pages/championships/ChampionshipsPage'
import ChampionshipDetailPage from './pages/championships/ChampionshipDetailPage'
import ProfilePage from './pages/players/ProfilePage'
import DirectoryPage from './pages/players/DirectoryPage'
import PlayerPage from './pages/players/PlayerPage'
import StatsPage from './pages/stats/StatsPage'
import ActivePlayPage from './pages/plays/ActivePlayPage'
import ManagePlayersPage from './pages/admin/ManagePlayersPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 },
  },
})

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <Spinner className="w-8 h-8" />
    </div>
  )
}

function ProtectedLayout() {
  const { session, loading, isPasswordRecovery } = useAuth()
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  if (isPasswordRecovery) return <Navigate to="/reset-password" replace />
  return (
    <ActivePlayProvider>
      <AppLayout />
    </ActivePlayProvider>
  )
}

function GuestRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (session) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<CollectionPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/plays" element={<PlaysPage />} />
        <Route path="/play/active" element={<ActivePlayPage />} />
        <Route path="/championships" element={<ChampionshipsPage />} />
        <Route path="/championships/new" element={<Navigate to="/championships" replace />} />
        <Route path="/championships/:id" element={<ChampionshipDetailPage />} />
        <Route path="/directory" element={<DirectoryPage />} />
        <Route path="/players/:id" element={<PlayerPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin/players" element={<ManagePlayersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
