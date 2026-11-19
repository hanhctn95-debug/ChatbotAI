import {createConversation, getConversations, logout, getMessages, sendMessage, deleteConversation, renameConversation, ApiError, generateTitle} from "../services/api";
import {useState, useEffect, type SubmitEvent, useRef} from "react";
import ReactMarkdown from 'react-markdown';
import {useParams, useNavigate} from 'react-router';
import remarkGfm from 'remark-gfm';

// Define the Conversation type
type Conversation = {
    id: string;
    title: string;
};

type Message = {
    content: string;
    role: "user" | "assistant";
    incomplete?: boolean;
    retrying?: boolean;
    requestId?: string;
}

type ChatPageProps = {
    onLogoutSuccess: (token: string | null) => void;
};

type ScrollSnapshot = {
    top: number;
    atBottom: boolean;
}


function ChatPage({onLogoutSuccess} : ChatPageProps){
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [error, setError] = useState('');
    //const [messages, setMessages] = useState<Message[]>([]);
    const [messagesByConversationId, setMessagesByConversationId] = useState<Record<string, Message[]>>({});
    const [inputMessage, setInputMessage] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null); 
    const [newTitle, setNewTile] = useState('');
    const [isRenameModelOpen, setIsRenameModelOpen] = useState(false);
    const [renameId, setRenameId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const activeAbortControllerRef = useRef<AbortController | null>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);
    const oneLineHeightRef = useRef<number | null>(null)
    const [isMultilineInput, setIsMultilineInput] = useState(false);

    // Scroll
    const chatContainerRef = useRef<HTMLDivElement>(null)
    const scrollPositionRef = useRef<Record<string, ScrollSnapshot>>({});

    // navigate URL by conversation id
    const {conversationId} = useParams<{conversationId: string}>();
    const navigate = useNavigate();
    const selectedConversationId = conversationId ?? '';
    function setSelectedConversationId(id : string | null){
        navigate(id ? `/chat/${id}` : `/chat`);
    }

    function handleChatScroll(){
        const element = chatContainerRef.current;
        if(!element) return;

        const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80
        if(selectedConversationId){
            scrollPositionRef.current[selectedConversationId] = {top: element.scrollTop, atBottom: atBottom}
        }
    }

    function removeRequestMessages(conversationId: string, requestId: string) {
    setMessagesByConversationId((prev) => {
        const current = prev[conversationId] ?? [];
        const assistantIndex = current.findIndex(
            (message) =>
                message.role === "assistant" && message.requestId === requestId
        );

        if (
            assistantIndex <= 0 ||
            current[assistantIndex - 1].role !== "user"
        ) {
            return prev;
        }

        const updated = current.filter(
            (_, index) =>
                index !== assistantIndex && index !== assistantIndex - 1
        );

        return { ...prev, [conversationId]: updated };
    });
}

    const selectedMessages = messagesByConversationId[selectedConversationId];
    const messages = selectedMessages ?? [];

    // Restore the saved position or follow the latest message after the DOM updates.
    useEffect(() => {
        const element = chatContainerRef.current;
        if (!element || !selectedConversationId || selectedMessages === undefined) return;

        const snapshot = scrollPositionRef.current[selectedConversationId];
        const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
        const nextTop = snapshot && !snapshot.atBottom
            ? Math.min(snapshot.top, maxScrollTop)
            : maxScrollTop;

        element.scrollTop = nextTop;

        const atBottom = maxScrollTop - nextTop < 80;
        scrollPositionRef.current[selectedConversationId] = {
            top: nextTop,
            atBottom,
        };
    }, [selectedConversationId, selectedMessages])

    // Handle log out
    async function onLogout() {
        await logout()
        onLogoutSuccess(null)
    }

    // Auto resize text area to fit content (max 200px)
    useEffect(() => {
        const textarea = messageInputRef.current;
        if(!textarea) return;
        textarea.style.height = "auto";

        if(oneLineHeightRef.current === null){
            oneLineHeightRef.current = textarea.scrollHeight;
        }
        if(inputMessage.length === 0){
            setIsMultilineInput(false);
        }
        else if(textarea.scrollHeight > oneLineHeightRef.current && !isMultilineInput && oneLineHeightRef.current !== null){
            setIsMultilineInput(true);
        }

        const maxHeight = 200;
        textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden"
    }, [inputMessage, isMultilineInput])

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
                setMessagesByConversationId((prev) => {
                    if(prev[selectedConversationId] !== undefined) return prev;
                    return {...prev, [selectedConversationId]: data};
                });
            }catch(error){
                if(error instanceof ApiError){
                    if(error.status === 500){
                        setError("Lỗi máy chủ");
                        return;
                    }
                    if(error.status === 403){
                        setError("Bạn không có quyền truy cập cuộc trò chuyện này");
                        return;
                    }
                    if(error.status === 404){
                        setError("Cuộc trò chuyện đã bị xóa hoặc không tồn tại");
                        return;
                    }
                    setError("Lỗi không thể tải tin nhắn");
                    return;
                }
                setError("Lỗi không thể tải tin nhắn");
            }
        }
        loadMessages();
    },[selectedConversationId])

    // Handle create new conversation
    async function handleCreateNewConversation(){
        try {
            setSelectedConversationId("")
        }catch (error) {
            if(error instanceof ApiError){
                if(error.status === 500){
                    setError("Lỗi máy chủ");
                    return;
                }
                setError("Xảy ra lỗi khi tạo cuộc trò chuyện");
                return;
            }
            setError("Xảy ra lỗi khi tạo cuộc trò chuyện");
        }
    }

    // Handle send messages
    async function handleSendMessages(event: SubmitEvent<HTMLElement>){
        event.preventDefault();
        if (!inputMessage.trim()) return;

        let targetConversationId = selectedConversationId;
        const isNewConversation = !targetConversationId;
        const userMessage = inputMessage;
        setInputMessage('');
        setIsLoading(true);
        // Give each new send a unique ID; retries reuse the ID stored on its assistant message.
        const requestId = crypto.randomUUID();

        let assistantMessageAdded = false;
        const abortController = new AbortController();
        activeAbortControllerRef.current = abortController;
        try{
            if(isNewConversation){
                const newConv = await createConversation();
                targetConversationId = newConv.id;
                setConversations((prev) => [
                    newConv,
                    ...prev
                ]);
                setSelectedConversationId(newConv.id)
            }

            scrollPositionRef.current[targetConversationId] = {
                top: chatContainerRef.current?.scrollTop ?? 0,
                atBottom: true,
            };

            setMessagesByConversationId((prev) => {
                const updated = prev[targetConversationId] ? [...prev[targetConversationId]] : [];
                return { ...prev, [targetConversationId]:
                    [...updated, 
                    {role: "user", content: userMessage},
                    {role: "assistant", content: "", requestId}]
                };
        });
            assistantMessageAdded = true;

            // Move the active conversation to the top of the list.
            if(!isNewConversation){
                setConversations((preConversations) => {
                    const activeConversation = preConversations.find(conv => conv.id === targetConversationId);
                    if(!activeConversation) return preConversations;
                    const Conversations = preConversations.filter(conv => conv.id !== targetConversationId);
                    return [activeConversation, ...Conversations]
                })
            }

            if(isNewConversation){
                void generateTitle(targetConversationId, userMessage).then(
                    (data) => {
                        setConversations((prev) => 
                            prev.map((conv) => conv.id === targetConversationId ? {...conv, title: data.title} : conv));
                    }
                ).catch(() => {
                    setError("Lỗi sinh tiêu đề cuộc trò truyện")
                })
            }
            await sendMessage(targetConversationId, userMessage, requestId, (chunk) => {
                setMessagesByConversationId((prev) => {
                    const updated = [...prev[targetConversationId]];
                    const last = updated[updated.length - 1];
                    updated[updated.length - 1] = { ...last, content: last.content + chunk };
                    return {...prev, [targetConversationId]: updated};
                });
            }, abortController.signal);
        }catch(error){
            if (abortController.signal.aborted) {
                removeRequestMessages(targetConversationId, requestId);
                setInputMessage(userMessage);
                return;
            }
            if(assistantMessageAdded){
                // Keep the partial reply visible and mark it as retryable.
                setMessagesByConversationId((prev) => {
                    const lastIndex = prev[targetConversationId].length - 1;
                    const lastMessage = prev[targetConversationId][lastIndex];
                    if(!lastMessage ||lastMessage.role !== "assistant") return prev;
                    const updated = [...prev[targetConversationId]];
                    updated[lastIndex] = {...lastMessage, incomplete: true};
                    return {...prev, [targetConversationId]: updated};
                })
            }
            if(error instanceof ApiError){
                if(error.status === 404){
                    setError("Không tìm thấy cuộc trò chuyện");
                    return;
                }
                if(error.status === 403){
                    setError("Bạn không có quyền truy cập cuộc trò truyện này");
                    return;
                }
                if(error.status === 400){
                    setError("Tin nhắn không hợp lệ");
                    return;
                }
                if(error.status === 500){
                    setError("Lỗi máy chủ");
                    return;
                }
                if(error.status === 502){
                    setError(error.message);
                    return;
                }
                setError("Lỗi phản hồi từ máy chủ");
                return;
            }
            setError("Lỗi không thể gửi tin nhắn");
        }finally{
            if (activeAbortControllerRef.current === abortController) {
                activeAbortControllerRef.current = null;
            }
            setIsLoading(false);
        }
    }

    // Retry a message when incomplete
    async function handleRetryMessage(assistantIndex: number) {
        // The user message is immediately before the assistant; its request ID identifies this send.
        const assistantMessage = messages[assistantIndex];
        const userMessage = messages[assistantIndex - 1];
        const requestId = assistantMessage?.requestId;

        if (isLoading || !selectedConversationId) return;
        if (assistantMessage?.role !== "assistant" || !assistantMessage.incomplete) return;
        if (!requestId || !userMessage || userMessage.role !== "user") {
            setError("Không tìm thấy thông tin yêu cầu để thử lại");
            return;
        }

        setIsLoading(true);
        setError("");
        // Clear the partial reply before replaying or regenerating the response.
        setMessagesByConversationId((prev) => {
            const updated = prev[selectedConversationId].map((item, index) =>
                index === assistantIndex
                    ? { ...item, content: "", incomplete: true, retrying: true }
                    : item
            )
            return { ...prev, [selectedConversationId]: updated};
        }
        );

        const abortController = new AbortController();
        activeAbortControllerRef.current = abortController;
        try {
            // A 409/processing response means the original request is active; poll with the same ID.
            for (let attempt = 0; attempt < 100; attempt++) {
                try {
                    await sendMessage(
                        selectedConversationId,
                        userMessage.content,
                        requestId,
                        (chunk) => {
                            setMessagesByConversationId((prev) => {
                                const updated = [...prev[selectedConversationId]].map((item, index) =>
                                    index === assistantIndex
                                        ? { ...item, content: item.content + chunk }
                                        : item
                                )
                                return { ...prev, [selectedConversationId]: updated};
                            }
                            );
                        }, abortController.signal
                    );
                    // sendMessage resolves only after the SSE done event arrives.
                    setMessagesByConversationId((prev) => {
                        const updated = [...prev[selectedConversationId]].map((item, index) =>
                            index === assistantIndex
                                ? { ...item, incomplete: false }
                                : item
                        )
                        return { ...prev, [selectedConversationId]: updated};
                    }
                    );
                    return;
                } catch (retryError) {
                    if (abortController.signal.aborted) {
                        removeRequestMessages(selectedConversationId, requestId);
                        setInputMessage(userMessage.content);
                        return;
                    }

                    // Poll again only for processing responses; surface other errors to the user.
                    if (
                        !(retryError instanceof ApiError) ||
                        retryError.code !== "processing" ||
                        attempt === 99
                    ) {
                        throw retryError;
                    }
                    await new Promise((resolve) => setTimeout(resolve, 1500));
                }
            }
        } catch (retryError) {
            setMessagesByConversationId((prev) => {
                const updated = [...prev[selectedConversationId]].map((item, index) =>
                    index === assistantIndex
                        ? { ...item, incomplete: true, retrying: false }
                        : item
                )
                return { ...prev, [selectedConversationId]: updated };
            }
            );
            if (retryError instanceof ApiError && retryError.code === "processing") {
                setError("Yêu cầu vẫn đang xử lý. Vui lòng thử lại sau.");
            } else {
                setError(
                    retryError instanceof ApiError
                        ? retryError.message
                        : "Lỗi không thể gửi tin nhắn"
                );
            }
        } finally {
            if (activeAbortControllerRef.current === abortController) {
                activeAbortControllerRef.current = null;
            }
            setMessagesByConversationId((prev) => {
                const updated = [...prev[selectedConversationId]].map((item, index) =>
                    index === assistantIndex ? { ...item, retrying: false } : item
                );
                return { ...prev, [selectedConversationId]: updated };
            });
            setIsLoading(false);
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
            setMessagesByConversationId(prev => {
                const updated = {...prev};
                delete updated[idToDelete];
                return updated;
            });
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
                <header className="flex justify-center  p-4" >
                    <h1 className="text-lg font-semibold">CHATBOT</h1>
                </header>
                <div className="flex-1 overflow-y-auto px-4 py-6"
                    ref={chatContainerRef}
                    onScroll={handleChatScroll}
                >
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
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                </div>
                                {/* Show retry controls only for incomplete replies. */}
                                {(msg.incomplete || msg.retrying) && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        {msg.retrying ? (
                                            <span className="text-xs text-slate-400">
                                                Đang thử lại, vui lòng chờ...
                                            </span>
                                        ) : (
                                            <>
                                                <span className="text-xs text-slate-400">
                                                    Phản hồi chưa hoàn tất
                                                </span>
                                                <button
                                                    type="button"
                                                    disabled={isLoading}
                                                    onClick={() => handleRetryMessage(index)}
                                                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-400 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                    aria-label="Thử lại phản hồi"
                                                >
                                                    <svg
                                                        aria-hidden="true"
                                                        viewBox="0 0 16 16"
                                                        fill="none"
                                                        className="h-3.5 w-3.5"
                                                    >
                                                        <path
                                                            d="M13.2 6A5.5 5.5 0 0 0 3.1 4.2L2 5.5M2 5.5V2.8M2 5.5h2.7M2.8 10A5.5 5.5 0 0 0 12.9 11.8L14 10.5m0 0v2.7m0-2.7h-2.7"
                                                            stroke="currentColor"
                                                            strokeWidth="1.4"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        />
                                                    </svg>
                                                    Thử lại
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        );
                    })
                    )}
                </div>
                </div>
                <form
                onSubmit={handleSendMessages}
                className="bg-slate-900/80 p-3"
                >
                <div className={`mx-auto flex w-full max-w-3xl rounded-3xl border border-slate-600 bg-slate-800 px-3 py-2 focus-within:border-blue-500 ${isMultilineInput ? "flex-col" : "flex-row items-end gap-2"}`}>
                    <textarea
                        rows={1}
                        onKeyDown={(event) => {
                            if(event.key !== "Enter" || event.shiftKey) return;
                            if(event.nativeEvent.isComposing) return;
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                        }}
                        ref={messageInputRef}
                        value={inputMessage}
                        placeholder="Nhập tin nhắn..."
                        className={`min-w-0 resize-none bg-transparent px-2 py-2 text-[15px] leading-5 text-white outline-none placeholder:text-slate-400 ${isMultilineInput ? "w-full" : "flex-1"}`}
                        disabled={isLoading}
                        onChange={(event) => setInputMessage(event.target.value)}
                    />
                    <div className={`flex justify-end ${isMultilineInput ? "w-full pt-2" : ""}`}>
                    {isLoading ? (
                        <button
                            key="stop"
                            type="button"
                            onClick={(event) => {
                                event.preventDefault();
                                activeAbortControllerRef.current?.abort();
                            }}
                            aria-label="Dừng tạo phản hồi"
                            title="Dừng"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-900 hover:bg-slate-200"
                        >
                            <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current">
                                <rect x="3" y="3" width="10" height="10" rx="1.5" />
                            </svg>
                        </button>
                    ) : (
                        <button
                            key="send"
                            type="submit"
                            disabled={!inputMessage.trim()}
                            aria-label="Gửi tin nhắn"
                            title="Gửi"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-900 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M12 19V5M5 12l7-7 7 7" />
                            </svg>
                        </button>
                    )}
                    </div>
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