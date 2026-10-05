import { useState, type SubmitEvent } from "react";
import { login, register } from "../services/api";

type AuthPageProps = {
  onLoginSuccess: (token: string) => void;
};

function AuthPage({onLoginSuccess}: AuthPageProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>){
    event.preventDefault()
    if (!email.trim() || !password){
        setError("Vui lòng nhâp tên đăng nhập và mật khẩu");
        return;
    }
    if (isRegister && password !== confirmPassword){
        setError("Mật khẩu xác nhận không khớp");
        return;
    }
    setError("");

    // Call api login or register
    try {
      const result = isRegister ? await register(email, password) : await login(email, password);
      if (isRegister){
        alert("Đăng ký thành công! Vui lòng đăng nhập.");
        setIsRegister(false);
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      }
      if(!isRegister){
        localStorage.setItem("token", result.token);
        onLoginSuccess(result.token);
      }
    }catch (error) {
      setError("Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại sau.");
    }
  
}

function handleToggleMode(){
  setIsRegister(!isRegister);
  setEmail("")
  setPassword("")
  setError("")
  setConfirmPassword("")
}
    
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f172a] p-6 text-[#e3e3e3]">
      <section className="w-full max-w-md rounded-2xl border border-[#2d2e30] bg-[#1e1f20] p-8">
        <h1 className="text-2xl font-semibold">{isRegister ? "Đăng ký" : "Đăng nhập"}</h1>

        <p className="mt-2 text-sm text-[#999c9e]">
          {isRegister ? "Tạo tài khoản để bắt đầu trò chuyện" : "Đăng nhập để tiếp tục trò chuyện."}
        </p>
        <form className="mt-6" onSubmit={handleSubmit}>
          <label htmlFor="email" className="mb-2 block text-sm">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="Nhập email"
            onChange={(event) => setEmail(event.target.value)}
            value={email}
            className="w-full rounded-lg border border-[#3a3b3d] bg-[#131314] px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          
          <label htmlFor="password" className="mb-2 mt-4 block text-sm">
            Mật khẩu
          </label>
          <input
            id="password"
            type="password"
            placeholder="Nhập mật khẩu"
            onChange={(event) => setPassword(event.target.value)}
            value={password}
            className="w-full rounded-lg border border-[#3a3b3d] bg-[#131314] px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          {
            isRegister && (
                <>
                    <label htmlFor="confirmPassword" className="mb-2 mt-4 block text-sm">
                        Nhâp lại mật khẩu
                    </label>
                    <input 
                        id="confirmPassword"
                        placeholder="Nhập lại mật khẩu"
                        value={confirmPassword}
                        type="password"
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="w-full rounded-lg border border-[#3a3b3d] bg-[#131314] px-3 py-2 text-sm outline-none focus:border-blue-400"    
                    />
                </>
            )
          }
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <button type="submit" 
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500">
            {isRegister ? "Đăng ký" : "Đăng nhập"}
            </button>
        </form>
        <button
            type = "button"
            onClick={handleToggleMode}
            className="mt-4 w-full text-sm text-blue-300 hover:text-blue-200"
        >
            {isRegister? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}
        </button>
      </section>
    </main>
  );
}

export default AuthPage;