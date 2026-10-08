import axios from 'axios';

const API = axios.create({
    baseURL : 'http://localhost:5000',
    headers : {
        'Content-Type' : 'application/json'
    },
    withCredentials: true
})

API.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if(token){
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Get all conversaitions
export const getConversations = async () => {
    const response = await API.get('/api/conversations');
    return response.data;
}

// Create conversation
export const createConversation = async (title:string) => {
    const response = await API.post('/api/conversations', {
        title : title,
    });
    return response.data;
}

// Delete conversation
export const deleteConversation = async (conversationId : number) => {
    const response = await API.delete(`/api/conversations/${conversationId}`);
    return response.data
}

// Rename conversation
export const renameConversation = async (conversationId : number, newTitle : string) => {
    const response = await API.patch(`/api/conversations/${conversationId}`, {
        new_title : newTitle
    });
    return response.data
}

// Get messages by conversation id
export const getMessages = async (conversationId : number) => {
    const response = await API.get(`/api/conversations/${conversationId}/messages`);
    return response.data;
}

// Send message
export const sendMessage = async (conversationId : number, message : string) => {
    const response = await API.post(`/api/chat/${conversationId}`, {
        message : message
    })
    return response.data
}

// Login
export const login = async (email: string, password: string) => {
    const response = await API.post(`/api/login`, {
        email: email,
        password: password
    })
    return response.data
}

// Register
export const register = async (email: string, password: string) => {
    const response = await API.post(`/api/register`, {
        email : email,
        password : password
    })
    return response.data
}

// Log out
export const logout = async () => {
    const response = await API.post('api/logout')
    return response.data
}