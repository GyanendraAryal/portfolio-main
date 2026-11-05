import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App'
import PageWrapper from './animate/PageWrapper'
import ErrorBoundary from './Components/ErrorBoundary'
import LoadingFallback from './Components/LoadingFallback'
import { ThemeProvider } from './context/ThemeContext'
import { ChatProvider } from './context/ChatContext'

const Home = lazy(() => import('./Pages/Home'))
const Services = lazy(() => import('./Pages/Services'))
const Work = lazy(() => import('./Pages/Work'))
const Resume = lazy(() => import('./Pages/Resume'))
const Contact = lazy(() => import('./Pages/Contact'))

const AdminShell = lazy(() => import('./admin/layout/AdminShell'))
const Dashboard = lazy(() => import('./admin/pages/Dashboard'))
const ImagesPage = lazy(() => import('./admin/pages/ImagesPage'))
const ResumePage = lazy(() => import('./admin/pages/ResumePage'))
const AdminLoginPage = lazy(() => import('./admin/pages/LoginPage'))
const ContactsPage = lazy(() => import('./admin/pages/ContactsPage'))
const SettingsPage = lazy(() => import('./admin/pages/SettingsPage'))

const wrap = (Component) => (
  <Suspense fallback={<LoadingFallback />}>
    <Component />
  </Suspense>
)

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path='/admin/login' element={wrap(AdminLoginPage)} />
      <Route path='/' element={<App />}>
        <Route path='' element={wrap(Home)} />
        <Route path='service' element={wrap(Services)} />
        <Route path='work' element={wrap(Work)} />
        <Route path='resume' element={wrap(Resume)} />
        <Route path='contact' element={wrap(Contact)} />
      </Route>
      <Route path='/admin' element={wrap(AdminShell)}>
        <Route index element={wrap(Dashboard)} />
        <Route path='images' element={wrap(ImagesPage)} />
        <Route path='images/:category' element={wrap(ImagesPage)} />
        <Route path='resume' element={wrap(ResumePage)} />
        <Route path='contacts' element={wrap(ContactsPage)} />
        <Route path='settings' element={wrap(SettingsPage)} />
      </Route>
    </>
  )
)

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <PageWrapper>
      <ThemeProvider>
        <ChatProvider>
          <RouterProvider router={router} />
        </ChatProvider>
      </ThemeProvider>
    </PageWrapper>
  </ErrorBoundary>
)
