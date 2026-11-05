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


// Create object api error
export class ApiError extends Error{
    status: number | undefined;
    constructor(status: number | undefined, message: string){
        super(message);
        this.status = status
    }
}


// Error response format
const toApiError = (err: unknown) => {
    if(axios.isAxiosError(err)){
        const serverMessage = err.response?.data?.error ?? err.response?.data?.message;
        return new ApiError(
            err.response?.status ?? 0,
            typeof serverMessage === 'string' ? serverMessage : 'Lỗi kết nối máy chủ')
    }
    return new ApiError(undefined, err instanceof Error ? err.message : "Lỗi không xác định");
}



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
            return Promise.reject(toApiError(error))
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
            pendingQueue.forEach((item) => item.reject(toApiError(refreshError)));
            pendingQueue = [];
            localStorage.removeItem("access_token");
            window.dispatchEvent(new Event("auth:expired"));
            return Promise.reject(toApiError(refreshError));
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
export const deleteConversation = async (conversationId : string) => {
    const response = await API.delete(`/api/conversations/${conversationId}`);
    return response.data
}

// Rename conversation
export const renameConversation = async (conversationId : string, newTitle : string) => {
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
// export const sendMessage = async (conversationId : string, message : string) => {
//     const response = await API.post(`/api/chat/${conversationId}`, {
//         message : message
//     })
//     return response.data
// }

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
    const response = await API.post('/api/logout')
    return response.data
}


// Send message (streaming)
export const sendMessage = async (
    conversationId: string,
    message: string,
    onChunk: (text: string) => void
) => {
    const url = `${API.defaults.baseURL}/api/chat/${conversationId}`;

    const doFetch = (token: string | null) =>
        fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: JSON.stringify({ message }),
        });

    let res = await doFetch(localStorage.getItem('access_token'));  

    // Refresh token if expired
    if (res.status === 401) {
        const body = await res.clone().json().catch(() => null);
        if (body?.error === 'Token has expired') {
            try {
                const r = await refreshAPI.post('/api/refresh');
                const newToken = r.data.access_token;
                localStorage.setItem('access_token', newToken);
                res = await doFetch(newToken);
            } catch (e) {
                localStorage.removeItem('access_token');
                window.dispatchEvent(new Event('auth:expired'));
                throw toApiError(e);
            }
        }
    }

    if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new ApiError(res.status, body?.error ?? 'Lỗi kết nối máy chủ');
    }

    // Read stream SSE
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Mỗi sự kiện SSE kết thúc bằng một dòng trống
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? ''; // phần chưa đủ sự kiện, giữ lại cho lần đọc sau

        for (const raw of events) {
            let event = 'message';
            let data = '';
            for (const line of raw.split('\n')) {
                if (line.startsWith('event: ')) event = line.slice(7);
                else if (line.startsWith('data: ')) data = line.slice(6);
            }
            if (!data) continue;

            const parsed = JSON.parse(data);
            if (event === 'error') throw new ApiError(500, parsed);
            if (event === 'done') return;
            onChunk(parsed);
        }
    }
    throw new ApiError(500, 'SSE failed: Unexpected end of stream');
};