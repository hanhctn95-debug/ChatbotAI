import {createConversation, getConversations, logout} from "../services/api";
import {useState, useEffect} from "react";

// Define the Conversation type
type Conversation = {
    id: number;
    title: string;
}


function ChatPage(){
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [error, setError] = useState('');


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
        <main className="flex min-h-screen bg-[#0f172a] text-white">
            <aside className="w-64 border-r border-slate-700 p-4">
                <h2 className="mb-4 text-lg font-semibold">Cuộc trò chuyện</h2>
                <button
                    onClick={handleCreateNewConversation}
                    className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm">Cuộc trò truyện mới
                </button>
                {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
                <div>
                    {conversations.map((conversation) => (
                        <button
                            key={conversation.id}
                            className="w-full rounded-lg p-2 text-left text-sm hover:bg-slate-800">
                            {conversation.title}
                        </button>
                    ))}
                </div>
            </aside>
            <section className="flex flex-1 flex-col">
                <header className="border-b border-slate-700 p-4">
                    <h1 className="text-lg font-semibold">Chatbot AI</h1>
                </header>
                <div className="flex-1 p-6">
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