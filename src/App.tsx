import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, AdminRoute, ManagerRoute } from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import PendingApproval from './pages/PendingApproval'
import Home from './pages/Home'
import Documents from './pages/Documents'
import DocumentCategory from './pages/DocumentCategory'
import Forms from './pages/Forms'
import FillForm from './pages/FillForm'
import AdminHome from './pages/admin/AdminHome'
import AdminUsers from './pages/admin/AdminUsers'
import AdminDocuments from './pages/admin/AdminDocuments'
import AdminForms from './pages/admin/AdminForms'
import AdminNews from './pages/admin/AdminNews'
import AdminSignRequests from './pages/admin/AdminSignRequests'
import AdminWorkerFiles from './pages/admin/AdminWorkerFiles'
import AdminIncidents from './pages/admin/AdminIncidents'
import AdminTimeOff from './pages/admin/AdminTimeOff'
import ManagerHome from './pages/manager/ManagerHome'
import SignDoc from './pages/SignDoc'
import IncidentReport from './pages/IncidentReport'
import TimeOff from './pages/TimeOff'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pending" element={<PendingApproval />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/documents/:categoryId" element={<DocumentCategory />} />
              <Route path="/forms" element={<Forms />} />
              <Route path="/forms/:assignmentId" element={<FillForm />} />
              <Route path="/sign/:assignmentId" element={<SignDoc />} />
              <Route path="/incident-report" element={<IncidentReport />} />
              <Route path="/time-off" element={<TimeOff />} />

              <Route element={<ManagerRoute />}>
                <Route path="/manager" element={<ManagerHome />} />
                <Route path="/manager/incidents" element={<AdminIncidents />} />
                <Route path="/manager/incidents/:workerId" element={<AdminIncidents />} />
                <Route path="/manager/time-off" element={<AdminTimeOff />} />
              </Route>

              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminHome />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/documents" element={<AdminDocuments />} />
                <Route path="/admin/forms" element={<AdminForms />} />
                <Route path="/admin/news" element={<AdminNews />} />
                <Route path="/admin/sign-requests" element={<AdminSignRequests />} />
                <Route path="/admin/worker-files" element={<AdminWorkerFiles />} />
                <Route path="/admin/worker-files/:workerId" element={<AdminWorkerFiles />} />
                <Route path="/admin/incidents" element={<AdminIncidents />} />
                <Route path="/admin/incidents/:workerId" element={<AdminIncidents />} />
                <Route path="/admin/time-off" element={<AdminTimeOff />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
