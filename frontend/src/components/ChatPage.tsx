import {createConversation, getConversations, logout, getMessages, sendMessage, deleteConversation} from "../services/api";
import {useState, useEffect, type SubmitEvent, useRef} from "react";

// Define the Conversation type
type Conversation = {
    id: string;
    title: string;
};

type Message = {
    content: string;
    role: string;
}

type ChatPageProps = {
    onLogoutSuccess: (token: string | null) => void;
};


function ChatPage({onLogoutSuccess} : ChatPageProps){
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [error, setError] = useState('');
    const [selectedConversationId, setSelectedConversationId] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null); 

    // Create ref
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // function scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({behavior: "smooth"})
    }

    // Call scrollToBottom whem mesages change
    useEffect(() => {
        scrollToBottom();
    }, [messages])

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

    // Load messages
    useEffect(() => {
        if(!selectedConversationId) return;
        async function loadMessages() {
            try{
                const data = await getMessages(selectedConversationId);
                setMessages(data);
            }catch(error){
                setError("Đã xảy ra lỗi khi tải tin nhắn");
            }
        }
        loadMessages();
    },[selectedConversationId])

    // Handle create new conversation
    async function handleCreateNewConversation(){
        try {
            const newConversation = await createConversation("Cuộc trò truyện mới");
            setConversations((currentConversations) => [newConversation, ...currentConversations]);
        }catch (error) {
            setError("Đã xảy ra lỗi khi tạo cuộc trò chuyện mới");
            }
    }

    // Handle send messages
    async function handleSendMessages(event: SubmitEvent<HTMLElement>){
        event.preventDefault();
        if (!inputMessage.trim()) return;

        let targetConversationId = selectedConversationId;
        const userMessage = inputMessage;
        setInputMessage('');

        try{
            if(!targetConversationId){
                const newConv = await createConversation(userMessage.slice(0, 25) + "...");
                setConversations((prev) => [newConv, ...prev]);
                setSelectedConversationId(newConv.id);
                targetConversationId = newConv.id;
            }

            setMessages((prev) => [...prev, {role : "user", content : userMessage}])
            setConversations((preConversations) => {
                const activeConversation = preConversations.find(conv => conv.id === targetConversationId);
                if(!activeConversation) return preConversations;
                const Conversations = preConversations.filter(conv => conv.id !== targetConversationId);
                return [activeConversation, ...Conversations]
            })
            const newMessage = await sendMessage(targetConversationId, userMessage);
            setMessages((prev) => [...prev, newMessage]);
        }catch(error){
            setError("Đã xảy ra lỗi khi gửi tin nhắn")
        }
    }

    // Click outside to close menu
    useEffect(() => {
        function handleClickOutside(){
            setOpenMenuId(null);
        }
        if(openMenuId){
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openMenuId])

    // Delete conversation
    async function handleDelteteConversation(idToDelete: string){
        const response = await deleteConversation(idToDelete);
        setConversations((preConversations) => {
            return preConversations.filter(conv => conv.id !== idToDelete)
        })
        if(selectedConversationId === openMenuId){
            setMessages([]);
            setSelectedConversationId('');
        }
    }


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
                    {conversations.map((conversation) => {
                        const isSelected = conversation.id === selectedConversationId;
                        const isMenuOpen = conversation.id === openMenuId;
                        return(
                        <div
                            onClick={() => setSelectedConversationId(conversation.id)}
                            key={conversation.id}
                            className={`relative group flex items-center justify-between w-full rounded-lg p-2 mb-1 text-sm hover:bg-slate-800 cursor-pointer
                            ${isSelected
                            ? 'bg-slate-700/60'
                            : ''}`}>
                            <span className="truncate flex-1 text-left">
                                {conversation.title}
                            </span>
                            <button 
                            onClick={
                                (event) => {
                                    event.stopPropagation();
                                    setOpenMenuId(openMenuId ? null : conversation.id);
                                }
                            }
                            className={`px-2 py-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-600 
                                        ${isMenuOpen ? 'block' : 'invisible group-hover:visible'}`}>
                                ...
                            </button>
                            {isMenuOpen && (
                                <div
                                className='absolute right-0 top-full mt-1 w-32 bg-slate-800 border border-slate-600 rounded-md shadow-lg z-50 overflow-hidden'
                                onClick={(e) => e.stopPropagation()}>
                                    <button 
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 text-slate-200"
                                        onClick={() => {
                                            setOpenMenuId(null);
                                        }}
                                    >
                                        Đổi tên
                                    </button>
                                    <button 
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 text-red-400"
                                        onClick={() => {
                                            handleDelteteConversation(openMenuId);
                                            setOpenMenuId(null);
                                        }}
                                    >
                                        Xóa
                                    </button>
                                </div>
                            )}
                        </div>
                        );  
                    })}
                </div>
                <button type="button" onClick={onLogout} className="w-full mt-4 rounded-lg hover:bg-red-600 px-4 py-2 text-sm border">
                    Đăng xuất
                </button>
            </aside>
            <section className="flex flex-1 flex-col">
                <header className="flex justify-center border-b border-slate-700 p-4" >
                    <h1 className="text-lg font-semibold">CHATBOT</h1>
                </header>
                <div className="flex-1 p-6 overflow-y-auto space-y-4">
                    {messages.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-slate-500">
                            Chưa có tin nhắn nào. Hãy bắt đầu trò chuyện!
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <div 
                                key={index} 
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                    msg.role === 'user' 
                                        ? 'bg-blue-600 text-white rounded-br-xs' 
                                        : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-xs'
                                }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef}></div>
                </div>
                <form onSubmit={handleSendMessages} className="flex gap-2 border-t border-slate-700 p-4">
                    <input 
                        type="text"
                        value={inputMessage}
                        placeholder="Nhập tin nhắn..."
                        className="flex-1 rounded-lg bg-slate-800 px-4 py-2 outline-none"
                        onChange={(event) => setInputMessage(event.target.value)}
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