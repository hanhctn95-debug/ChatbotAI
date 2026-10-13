import axios from 'axios';

const API = axios.create({
    baseURL : 'http://localhost:5000',
    headers : {
        'Content-Type' : 'application/json'
    },
    withCredentials: true
})

const refreshAPI = axios.create({
    baseURL : 'http://localhost:5000',
    headers : {
        'Content-Type' : 'application/json'
    },
    withCredentials: true
})

// Use an access token with every request
API.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if(token){
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});


type QueueItem = {
    resolve: (token: string) => void,
    reject: (error: unknown) => void
}

let isRefreshing = false;
let pendingQueue: QueueItem[] = []

// Call api refresh to get a new token
API.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const isExpired = error.response?.status === 401 && error.response?.data?.error === "Token has expired";
        if(!isExpired || !originalRequest || originalRequest._retry){
            return Promise.reject(error)
        }
        originalRequest._retry = true;
        if(isRefreshing){
            return new Promise((resolve, reject) => {
                pendingQueue.push({
                    resolve: (newToken) => {
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        resolve(API(originalRequest));
                    }, reject,
                })
            })
        }
        isRefreshing = true;
        try {
            const response = await refreshAPI.post('/api/refresh');
            const new_token = response.data.access_token;
            localStorage.setItem('access_token', new_token);

            pendingQueue.forEach((item) => item.resolve(new_token));
            pendingQueue = [];

            originalRequest.headers.Authorization = `Bearer ${new_token}`;
            return API(originalRequest);
        }catch(refreshError){
            pendingQueue.forEach((item) => item.reject(refreshError));
            pendingQueue = [];
            localStorage.removeItem("access_token");
            window.dispatchEvent(new Event("auth:expired"));
            return Promise.reject(refreshError);
        }finally{
            isRefreshing = false;
        }
    }
)

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
export const getMessages = async (conversationId : string) => {
    const response = await API.get(`/api/conversations/${conversationId}/messages`);
    return response.data;
}

// Send message
export const sendMessage = async (conversationId : string, message : string) => {
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