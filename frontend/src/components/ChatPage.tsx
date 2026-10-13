import {createConversation, getConversations, logout, getMessages, sendMessage} from "../services/api";
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
            const newMessage = await sendMessage(targetConversationId, userMessage);
            setMessages((prev) => [...prev, newMessage]);
        }catch(error){
            setError("Đã xảy ra lỗi khi gửi tin nhắn")
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
                    {conversations.map((conversation) => {
                        const isSelected = conversation.id === selectedConversationId;
                        return(
                        <button
                            onClick={() => setSelectedConversationId(conversation.id)}
                            key={conversation.id}
                            className={`w-full rounded-lg p-2 text-left text-sm hover:bg-slate-800
                            ${isSelected
                            ? 'bg-slate-700/60'
                            : 's'}`}>
                            {conversation.title}
                        </button>
                        );
                    })}
                </div>
                <button type="button" onClick={onLogout} className="w-full mt-4 rounded-lg hover:bg-red-600 px-4 py-2 text-sm">
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