import { Outlet } from 'react-router-dom'
import Navbar from './Components/Navbar'
import Footer from './Components/Footer'
import { PortfolioProfileProvider } from './context/PortfolioProfileContext'
import ChatWidget from './components/Chat/ChatWidget'

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
