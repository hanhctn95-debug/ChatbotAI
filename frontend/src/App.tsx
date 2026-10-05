import { useState } from 'react';
import AuthPage from './components/AuthPage'
import ChatPage from './components/ChatPage'

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));

  return (
  <>
    {!token && (<AuthPage onLoginSuccess={(newToken) => setToken(newToken)}/>)}
    {token && (<ChatPage />)}
  </> );
}

export default App