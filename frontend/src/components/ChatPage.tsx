import {createConversation, getConversations, logout, getMessages, sendMessage, deleteConversation, renameConversation, ApiError} from "../services/api";
import {useState, useEffect, type SubmitEvent, useRef} from "react";
import ReactMarkdown from 'react-markdown';
import {useParams, useNavigate} from 'react-router';

// Define the Conversation type
type Conversation = {
    id: string;
    title: string;
};

type Message = {
    content: string;
    role: "user" | "assistant";
}

type ChatPageProps = {
    onLogoutSuccess: (token: string | null) => void;
};


function ChatPage({onLogoutSuccess} : ChatPageProps){
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [error, setError] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null); 
    const [newTitle, setNewTile] = useState('');
    const [isRenameModelOpen, setIsRenameModelOpen] = useState(false);
    const [renameId, setRenameId] = useState<string | null>(null)

    // navigate URL by conversation id
    const {conversationId} = useParams<{conversationId: string}>();
    const navigate = useNavigate();
    const selectedConversationId = conversationId ?? '';
    function setSelectedConversationId(id : string | null){
        navigate(id ? `/chat/${id}` : `/chat`);
    }

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
                if(error instanceof ApiError){
                    if(error.status === 500){
                        setError("Lỗi máy chủ");
                        return;
                    }
                    setError("Đã xảy ra lỗi khi tải cuộc trò chuyện");
                    return;
                }
                setError("Đã xảy ra lỗi khi tải cuộc trò chuyện");
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
            setSelectedConversationId(newConversation.id);
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
            setIsRenameModelOpen(false);
            setOpenMenuId(null);
        }
        if(openMenuId || isRenameModelOpen){
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [openMenuId, isRenameModelOpen])

    // Delete conversation
    async function handleDelteteConversation(idToDelete: string | null){
        if(!idToDelete) return;
        const data = await deleteConversation(idToDelete);
        if(data.error){
            setError("Lỗi không thể xóa, vui lòng thử lại sau");
            return;
        }
        setConversations((preConversations) => {
            return preConversations.filter(conv => conv.id !== idToDelete)
        })
        if(selectedConversationId === openMenuId){
            setMessages([]);
            setSelectedConversationId('');
        }
    }

    // Rename conversation
    async function handleRenameConversation(idToRename: string | null){
        if(!idToRename) return;
        try{
            const data = await renameConversation(idToRename, newTitle);
            setConversations((preConversation) => {
                return preConversation.map((conv) => conv.id === idToRename ? {...conv, title: data.title} : conv);
            })
            setNewTile('');
            setRenameId(null);
            setIsRenameModelOpen(false);
        }catch(error){
            setError("Lỗi khi đổi tên");
        }
    }  

    // Delete error in 4 seconds
    useEffect(() => {
        if(!error) return;
        const timer = setTimeout(() => setError(''), 4000);
        return () => clearTimeout(timer);

    }, [error])


    return (
        <main className="flex h-screen bg-[#0f172a] text-white">
            {error && (
                    <div
                        role="alert"
                        className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-red-500/40 bg-slate-800 px-4 py-3 text-sm text-red-300 shadow-lg"
                    >
                        <span>{error}</span>
                        <button
                            type="button"
                            aria-label="Đóng"
                            onClick={() => setError('')}
                            className="text-slate-400 hover:text-white"
                        >
                            X
                        </button>
                    </div>
            )}
            <aside className="flex flex-col w-64 border-r border-slate-700 p-4">
                <h2 className="mb-4 text-lg font-semibold">Cuộc trò chuyện</h2>
                <button
                    onClick={handleCreateNewConversation}
                    className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm">Cuộc trò chuyện mới
                </button>
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
                                    setOpenMenuId(openMenuId ? null : conversation.id); // If the menu closed, set the id to open it. If the menu is open set null to close
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
                                            setRenameId(conversation.id);
                                            setIsRenameModelOpen(true);
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
                <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="mx-auto w-full max-w-3xl space-y-4">
                    {messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-slate-500">
                        Chưa có tin nhắn nào. Hãy bắt đầu trò chuyện!
                    </div>
                    ) : (
                    messages.map((msg, index) => {
                        const isUser = msg.role === "user";

                        return (
                        <div
                            key={index}
                            className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={
                                    isUser
                                        ? "ml-auto w-fit max-w-[75%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-3 text-sm leading-7 text-white shadow-sm"
                                        : "w-full text-sm leading-7 text-slate-100"
                                }
                            >
                                <div className="prose prose-invert max-w-none [&>p]:my-0">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                            </div>
                        </div>
                        );
                    })
                    )}
                    <div ref={messagesEndRef}></div>
                </div>
                </div>
                <form
                onSubmit={handleSendMessages}
                className="bg-slate-900/80 p-3"
                >
                <div className="mx-auto flex max-w-4xl items-center gap-3">
                    <input
                    type="text"
                    value={inputMessage}
                    placeholder="Nhập tin nhắn..."
                    className="flex-1 rounded-full border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-blue-500"
                    onChange={(event) => setInputMessage(event.target.value)}
                    />
                    <button
                    type="submit"
                    className="rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500"
                    >
                    Gửi
                    </button>
                </div>
                </form>
            </section>
            {isRenameModelOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-xl bg-slate-800 border border-slate-700 p-6 text-white shadow-xl"
                    onClick={(event) => event.stopPropagation()}>
                        <h3 className="text-lg font-semibold mb-4">Đổi tên cuộc trò chuyện</h3>
                        
                        <input 
                            type="text"
                            placeholder="Nhập tên mới..."
                            className="w-full rounded-lg bg-slate-900 border border-slate-600 px-4 py-2.5 text-sm outline-none focus:border-blue-500 mb-6"
                            value={newTitle}
                            onChange={(event) => setNewTile(event.target.value)}
                        />
                        <div className="flex justify-end gap-3">
                            <button 
                                type="button"
                                className="rounded-lg px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 transition-colors"
                                onClick={() => {
                                    setIsRenameModelOpen(false);
                                    setNewTile('')
                                }}
                            >
                                Hủy
                            </button>
                            <button 
                                type="submit"
                                className="rounded-lg px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 transition-colors font-medium"
                                onClick={() => {
                                    handleRenameConversation(renameId);
                                }}
                            >
                                Đổi tên
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}

export default ChatPage