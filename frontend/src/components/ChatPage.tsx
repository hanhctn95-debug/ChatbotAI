import {createConversation, getConversations, logout} from "../services/api";
import {useState, useEffect} from "react";

// Define the Conversation type
type Conversation = {
    id: number;
    title: string;
};

type ChatPageProps = {
    onLogoutSuccess: (token: string | null) => void;
};


function ChatPage({onLogoutSuccess} : ChatPageProps){
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [error, setError] = useState('');

    // Handle log out
    async function onLogout() {
        await logout()
        onLogoutSuccess(null)
    }

    // Load all conversations when starting the page
    useEffect(() => {
        async function loadConversations() {
            try{
                const data = await getConversations();
                setConversations(data);
            }catch (error) {
                setError("Đã xảy ra lỗi khi tải danh sách cuộc trò chuyện");
            }
        }
        loadConversations();
    }, [])

    // Handle create new conversation
    async function handleCreateNewConversation(){
        try {
            const newConversation = await createConversation("Cuộc trò truyện mới");
            setConversations((currentConversations) => [newConversation, ...currentConversations]);
        }catch (error) {
            setError("Đã xảy ra lỗi khi tạo cuộc trò chuyện mới");
            }
    }

    // hadle rename conversation


    return (
        <main className="flex h-screen bg-[#0f172a] text-white">
            <aside className="flex flex-col w-64 border-r border-slate-700 p-4">
                <h2 className="mb-4 text-lg font-semibold">Cuộc trò chuyện</h2>
                <button
                    onClick={handleCreateNewConversation}
                    className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm">Cuộc trò chuyện mới
                </button>
                {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
                <div className="mt-4 flex-1 overflow-y-auto custom-scrollbar">
                    {conversations.map((conversation) => (
                        <button
                            key={conversation.id}
                            className="w-full rounded-lg p-2 text-left text-sm hover:bg-slate-800">
                            {conversation.title}
                        </button>
                    ))}
                </div>
                <button type="button" onClick={onLogout} className="w-full mt-4 rounded-lg hover:bg-red-600 px-4 py-2 text-sm">
                    Đăng xuất
                </button>
            </aside>
            <section className="flex flex-1 flex-col">
                <header className="flex border-b border-slate-700 p-4" >
                    <h1 className="text-lg font-semibold">Chatbot AI</h1>
                </header>
                <div className="flex-1 p-6 overflow-y-auto">
                    Khu vực hiển thị tin nhắn
                </div>
                <form className="flex gap-2 border-t border-slate-700 p-4">
                    <input 
                        type="text"
                        placeholder="Nhập tin nhắn..."
                        className="flex-1 rounded-lg bg-slate-800 px-4 py-2 outline-none"
                    />
                    <button 
                        type="submit"
                        className="rounded-lg bg-blue-600 px-4 py-2">
                        Gửi
                    </button>
                </form>
            </section>
        </main>
    )
}

export default ChatPage