import { Outlet } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import { PortfolioProfileProvider } from './context/PortfolioProfileContext'
import ChatWidget from './components/chat/ChatWidget'

function App() {
  return (
    <PortfolioProfileProvider>
      <Navbar />
      <Outlet />
      <Footer />
      <ChatWidget />
    </PortfolioProfileProvider>
  )
}

export default App
