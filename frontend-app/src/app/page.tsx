'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, gql, useSubscription } from '@apollo/client';
import { authApi } from '@/lib/api';
import { jwtDecode } from 'jwt-decode';

// --- State Types ---
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
  createdBy: string;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

// --- GraphQL Operations ---
const GET_TASKS = gql`
  query GetTasks {
    tasks {
      id
      title
      description
      status
      createdBy
      createdAt
    }
  }
`;

const CREATE_TASK = gql`
  mutation CreateTask($title: String!, $description: String) {
    createTask(title: $title, description: $description) {
      id
      title
      description
      status
      createdBy
      createdAt
    }
  }
`;

const DELETE_TASK = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`;

const TASK_ADDED_SUBSCRIPTION = gql`
  subscription OnTaskAdded {
    taskAdded {
      id
      title
      description
      status
      createdBy
      createdAt
    }
  }
`;

// --- Helper: Cek jika token valid ---
const isTokenExpired = (token: string): boolean => {
  try {
    const { exp } = jwtDecode(token);
    if (!exp) return true;
    return Date.now() >= exp * 1000;
  } catch (error) {
    return true;
  }
};

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoginView, setIsLoginView] = useState(true);
  
  // State untuk Form
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '' });
  
  // State untuk Data
  const [error, setError] = useState<string | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);

  // GraphQL Hooks
  const { data: tasksData, loading: tasksLoading, refetch: refetchTasks } = useQuery(GET_TASKS, {
    skip: !token, // Hanya fetch jika sudah login
    onCompleted: (data) => setAllTasks(data.tasks || []),
    onError: (err) => {
      setError(err.message);
      // Jika token error (misal expired), auto logout
      if (err.message.includes('Unauthorized') || err.message.includes('Not authenticated')) {
        handleLogout();
      }
    },
  });
  
  const [createTask] = useMutation(CREATE_TASK, {
    onError: (err) => setError(err.message),
  });
  
  const [deleteTask] = useMutation(DELETE_TASK, {
    onError: (err) => setError(err.message),
  });

  // GraphQL Subscription
  useSubscription(TASK_ADDED_SUBSCRIPTION, {
    skip: !token,
    onData: ({ data }) => {
      const newTask = data.data.taskAdded;
      setAllTasks((prevTasks) => [...prevTasks, newTask]);
    }
  });

  // --- Auth Effect ---
  // Cek token di localStorage saat komponen mount
  useEffect(() => {
    const storedToken = localStorage.getItem('jwt-token');
    if (storedToken && !isTokenExpired(storedToken)) {
      try {
        const decodedUser = jwtDecode<User>(storedToken);
        setToken(storedToken);
        setUser(decodedUser);
      } catch (e) {
        console.error("Token invalid:", e);
        localStorage.removeItem('jwt-token');
      }
    } else {
      localStorage.removeItem('jwt-token');
    }
  }, []);

  // --- Auth Handlers ---
  const handleAuthInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAuthForm({ ...authForm, [e.target.name]: e.target.value });
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const response = isLoginView
        ? await authApi.login({ email: authForm.email, password: authForm.password })
        : await authApi.register({ name: authForm.name, email: authForm.email, password: authForm.password, role: authForm.role });

      const { token: newToken } = response.data;
      const decodedUser = jwtDecode<User>(newToken);
      
      localStorage.setItem('jwt-token', newToken);
      setToken(newToken);
      setUser(decodedUser);
      refetchTasks(); // Ambil tasks setelah login
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'An error occurred');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setAllTasks([]);
    localStorage.removeItem('jwt-token');
  };

  // --- Task Handlers ---
  const handleTaskInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setTaskForm({ ...taskForm, [e.target.name]: e.target.value });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createTask({
        variables: {
          title: taskForm.title,
          description: taskForm.description,
        },
      });
      setTaskForm({ title: '', description: '' });
      // Tidak perlu refetch, subscription akan menangani update
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteTask = async (id: string) => {
    setError(null);
    try {
      await deleteTask({ variables: { id } });
      // Hapus dari state lokal
      setAllTasks((prev) => prev.filter(task => task.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  // --- Render Auth Form ---
  const renderAuthForm = () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">
          {isLoginView ? 'Login' : 'Register'}
        </h2>
        {error && <p className="text-red-500 text-center">{error}</p>}
        <form className="space-y-6" onSubmit={handleAuthSubmit}>
          {!isLoginView && (
            <>
            <input
              name="name"
              type="text"
              required
              className="w-full px-3 py-2 border rounded-md text-gray-900"
              placeholder="Name"
              value={authForm.name}
              onChange={handleAuthInputChange}
            />
            <select
              name="role"
              value={authForm.role}
              onChange={handleAuthInputChange}
              className="w-full px-3 py-2 border rounded-md text-gray-900"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            </>
          )}
          <input
            name="email"
            type="email"
            required
            className="w-full px-3 py-2 border rounded-md text-gray-900"
            placeholder="Email address"
            value={authForm.email}
            onChange={handleAuthInputChange}
          />
          <input
            name="password"
            type="password"
            required
            className="w-full px-3 py-2 border rounded-md text-gray-900"
            placeholder="Password"
            value={authForm.password}
            onChange={handleAuthInputChange}
          />
          <button
            type="submit"
            className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            {isLoginView ? 'Login' : 'Register'}
          </button>
        </form>
        <p className="text-sm text-center text-gray-600">
          {isLoginView ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setIsLoginView(!isLoginView); setError(null); }}
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            {isLoginView ? 'Register' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );

  // --- Render Dashboard ---
  const renderDashboard = () => (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {user?.email} ({user?.role})
          </h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Task Form */}
          <div className="lg:col-span-1 bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Task</h2>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <input
                name="title"
                type="text"
                placeholder="Task Title"
                value={taskForm.title}
                onChange={handleTaskInputChange}
                className="w-full border rounded-md px-3 py-2 text-gray-900"
                required
              />
              <textarea
                name="description"
                placeholder="Task Description"
                value={taskForm.description}
                onChange={handleTaskInputChange}
                className="w-full border rounded-md px-3 py-2 h-24 text-gray-900"
              />
              <button
                type="submit"
                className="w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
              >
                Add Task
              </button>
            </form>
          </div>

          {/* Tasks List */}
          <div className="lg:col-span-2 bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Task List (Real-time)</h2>
            {tasksLoading ? (
              <p className="text-gray-900">Loading tasks...</p>
            ) : (
              <div className="space-y-4">
                {allTasks.map((task) => (
                  <div key={task.id} className="flex justify-between items-center p-4 border rounded">
                    <div className="text-gray-900">
                      <h3 className="font-semibold text-lg">{task.title}</h3>
                      <p className="text-gray-600 mt-1">{task.description}</p>
                      <p className="text-gray-500 text-xs mt-2">
                        Status: {task.status} | Created by user: {task.createdBy}
                      </p>
                    </div>
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return token ? renderDashboard() : renderAuthForm();
}