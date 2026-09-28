import React from "react";
interface Conversation {
    id: number;
    title: string;
}
interface SidebarProps {
    conversations: Conversation[];
    currentId: number | null;
    onSelectConversation: (id: number) => void;
    onNewChat: () => void
    onDeleteConversation: (id: number, e: React.MouseEvent) => void;
}

export const Sidebar = ({
    conversations, 
    currentId, 
    onSelectConversation, 
    onNewChat, 
    onDeleteConversation}: SidebarProps) => {

    return (
        <div className="w-64 bg-gray-900 text-white h-screen flex flex-col p-3 border-r border-gray-800">
            <button onClick={onNewChat} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2.5 px-4 rounded-lg mb-4 transition">
                + Đoạn chat mới
            </button>
            <div className="flex-1 overflow-y-auto space-y-1">
                {conversations.map((conv) => {
                    const isActive = conv.id === currentId;
                    return (
                        <div
                            key={conv.id}
                            onClick={() => onSelectConversation(conv.id)}
                            className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer text-sm transition ${
                                isActive ? 'bg-gray-800 text-white font-medium' : 'hover:bg-gray-800/50 text-gray-300'
                            }`}
                        >
                            <span className="truncate flex-1">{conv.title}</span>
              
                            <button
                                onClick={(e) => onDeleteConversation(conv.id, e)}
                                className="text-gray-400 hover:text-red-400 p-1"
                            >
                                🗑️
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    )
}