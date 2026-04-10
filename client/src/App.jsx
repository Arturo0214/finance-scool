import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import Landing from './pages/Landing'
import Login from './pages/Login'
import AdminPanel from './pages/AdminPanel'
import PrivacyPolicy from './pages/PrivacyPolicy'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin/*" element={<AdminPanel />} />
      </Routes>
    </AuthProvider>
  )
}
