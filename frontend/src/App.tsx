import { useEffect, useState } from 'react';
import AuthPage from './components/AuthPage';
import ChatPage from './components/ChatPage';
import { Navigate, Route, Routes } from 'react-router';

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("access_token"));
  useEffect(() => {
    const handleExpired = () => {
      setToken(null)
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired)
  }, [])
  if(!token){
    return (
      <AuthPage onLoginSuccess={setToken} />
    )
    }
    return(
      <Routes>
        <Route path='/chat' element={<ChatPage onLogoutSuccess={setToken}/>}></Route>
        <Route path='/chat/:conversationId' element={<ChatPage onLogoutSuccess={setToken}/>}></Route>
        <Route path='*' element={<Navigate to="/chat" replace/>}></Route>
      </Routes>
    )
}

export default App