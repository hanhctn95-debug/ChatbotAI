import { useState, type SubmitEvent } from "react";
import React from "react";

function AuthPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, serError] = useState('');

function handleSubmit(event: SubmitEvent<HTMLFormElement>){
    if (!username || !password){
        serError("Vui lòng nhâp tên đăng nhập và mật khẩu")
        return;
    }
    if (isRegister && password !== confirmPassword){
        serError("Mật khẩu xác nhận không khớp")
        return;
    }
    serError("")
}
    
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#E8F5E9] p-6 text-[#e3e3e3]">
      <section className="w-full max-w-md rounded-2xl border border-[#2d2e30] bg-[#1e1f20] p-8">
        <h1 className="text-2xl font-semibold">{isRegister ? "Đăng ký" : "Đăng nhập"}</h1>

        <p className="mt-2 text-sm text-[#999c9e]">
          {isRegister ? "Tạo tài khoản để bắt đầu trò chuyện" : "Đăng nhập để tiếp tục trò chuyện."}
        </p>
        <form className="mt-6" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="username" className="mb-2 block text-sm">
            Tên đăng nhập
          </label>
          <input
            id="username"
            type="text"
            placeholder="Nhập tên đăng nhập"
            onChange={(event) => setUsername(event.target.value)}
            value={username}
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
          <button type="submit" 
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500">
            {isRegister ? "Đăng ký" : "Đăng nhập"}
            </button>
        </form>
        <button
            type = "button"
            onClick={() => setIsRegister(!isRegister)}
            className="mt-4 w-full text-sm text-blue-300 hover:text-blue-200"
        >
            {isRegister? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}
        </button>
      </section>
    </main>
  );
}

export default AuthPage;