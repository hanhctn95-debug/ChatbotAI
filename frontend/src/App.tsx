import { useEffect, useState } from 'react';
import AuthPage from './components/AuthPage'
import ChatPage from './components/ChatPage'

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("access_token"));
  useEffect(() => {
    console.log("listener đã được cài");
    const handleExpired = () => {
      setToken(null)
      console.log("nhận được auth:expired");
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired)
  }, [])
  return (
  <>
    {!token && (<AuthPage onLoginSuccess={(newToken) => setToken(newToken)}/>)}
    {token && (<ChatPage onLogoutSuccess={(token) => setToken(token)}/>)}
  </> );
}

export default App