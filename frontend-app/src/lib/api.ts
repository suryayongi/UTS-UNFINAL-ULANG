import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tambahkan interceptor untuk menyisipkan token ke setiap request
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('jwt-token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// API calls untuk Autentikasi (via REST)
export const authApi = {
  register: (userData: { name: string; email: string; password: string; role?: string }) => 
    apiClient.post('/api/auth/register', userData),
  
  login: (credentials: { email: string; password: string }) => 
    apiClient.post('/api/auth/login', credentials),
};


// User API calls
// export const userApi = {
//   getUsers: () => apiClient.get('/api/users'),
//   getUser: (id: string) => apiClient.get(`/api/users/${id}`),
//   createUser: (userData: { name: string; email: string; age: number }) => 
//     apiClient.post('/api/users', userData),
//   updateUser: (id: string, userData: { name?: string; email?: string; age?: number }) => 
//     apiClient.put(`/api/users/${id}`, userData),
//   deleteUser: (id: string) => apiClient.delete(`/api/users/${id}`),
// };