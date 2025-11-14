const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { createServer } = require('http');
const { ApolloServerPluginDrainHttpServer } = require('apollo-server-core');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const { PubSub } = require('graphql-subscriptions');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const pubsub = new PubSub();

// Enable CORS
app.use(cors({
  origin: [
    'http://localhost:3000', // API Gateway
    'http://localhost:3002', // Frontend
    'http://api-gateway:3000', // Docker container name
    'http://frontend-app:3002' // Docker container name
  ],
  credentials: true
}));

// In-memory data store (ganti dengan database)
let tasks = [
  {
    id: '1',
    title: 'Setup Project',
    description: 'Initial setup for the microservices project.',
    status: 'COMPLETED',
    assignedTo: '1', // User ID
    createdBy: '1',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    title: 'Implement Auth',
    description: 'Implement JWT authentication in User Service and Gateway.',
    status: 'IN_PROGRESS',
    assignedTo: '1',
    createdBy: '1',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Build Frontend',
    description: 'Create the Next.js frontend application.',
    status: 'TODO',
    assignedTo: '2',
    createdBy: '1',
    createdAt: new Date().toISOString(),
  }
];

// GraphQL type definitions
const typeDefs = `
  enum TaskStatus {
    TODO
    IN_PROGRESS
    COMPLETED
  }

  type Task {
    id: ID!
    title: String!
    description: String
    status: TaskStatus!
    assignedTo: ID
    createdBy: ID!
    createdAt: String!
  }

  type Query {
    tasks(status: TaskStatus): [Task!]!
    task(id: ID!): Task
  }

  type Mutation {
    createTask(title: String!, description: String): Task!
    updateTask(id: ID!, title: String, description: String, status: TaskStatus, assignedTo: ID): Task!
    deleteTask(id: ID!): Boolean!
  }

  type Subscription {
    taskAdded: Task!
    taskUpdated: Task!
    taskDeleted: ID!
  }
`;

// Publikasi event
const TASK_ADDED = 'TASK_ADDED';
const TASK_UPDATED = 'TASK_UPDATED';
const TASK_DELETED = 'TASK_DELETED';

// GraphQL resolvers
const resolvers = {
  Query: {
    // Dapatkan semua task, bisa difilter by status
    tasks: (_, { status }, context) => {
      // context.user didapat dari header X-User-Payload
      if (!context.user) throw new Error('Not authenticated');
      
      if (status) {
        return tasks.filter(task => task.status === status);
      }
      return tasks;
    },
    // Dapatkan satu task
    task: (_, { id }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      return tasks.find(task => task.id === id);
    },
  },

  Mutation: {
    createTask: (_, { title, description }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      const newTask = {
        id: uuidv4(),
        title,
        description: description || '',
        status: 'TODO',
        assignedTo: null,
        createdBy: context.user.id, // Set creator dari token
        createdAt: new Date().toISOString(),
      };
      
      tasks.push(newTask);
      pubsub.publish(TASK_ADDED, { taskAdded: newTask });
      
      return newTask;
    },

    updateTask: (_, { id, title, description, status, assignedTo }, context) => {
      if (!context.user) throw new Error('Not authenticated');

      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) {
        throw new Error('Task not found');
      }

      const originalTask = tasks[taskIndex];
      const updatedTask = {
        ...originalTask,
        ...(title && { title }),
        ...(description && { description }),
        ...(status && { status }),
        ...(assignedTo && { assignedTo }), // Bisa assign ke user lain
      };

      tasks[taskIndex] = updatedTask;
      pubsub.publish(TASK_UPDATED, { taskUpdated: updatedTask });
      
      return updatedTask;
    },

    deleteTask: (_, { id }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      // REQUIREMENT: Hanya admin yang bisa delete
      if (context.user.role !== 'admin') {
        throw new Error('Not authorized. Only admins can delete tasks.');
      }

      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) {
        return false;
      }

      tasks.splice(taskIndex, 1);
      pubsub.publish(TASK_DELETED, { taskDeleted: id });
      
      return true;
    },
  },

  Subscription: {
    taskAdded: {
      subscribe: () => pubsub.asyncIterator([TASK_ADDED]),
    },
    taskUpdated: {
      subscribe: () => pubsub.asyncIterator([TASK_UPDATED]),
    },
    taskDeleted: {
      subscribe: () => pubsub.asyncIterator([TASK_DELETED]),
    },
  },
};

// --- Server Setup ---
async function startServer() {
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const httpServer = createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  // `useServer` menggantikan `SubscriptionServer`
  const serverCleanup = useServer({ 
    schema,
    context: (ctx) => {
      // Di sini kita bisa handle auth untuk WebSocket
      console.log('WebSocket connection established');
      return {};
    },
  }, wsServer);

  // Apollo Server
  const server = new ApolloServer({
    schema,
    context: ({ req }) => {
      // --- Ini adalah bagian penting ---
      // Kita baca header 'X-User-Payload' yang dikirim oleh API Gateway
      const userPayload = req.headers['x-user-payload'];
      if (userPayload) {
        try {
          const user = JSON.parse(userPayload);
          // Tambahkan user ke context
          return { user };
        } catch (e) {
          console.error('Error parsing user payload:', e);
          return {};
        }
      }
      return {};
    },
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  const PORT = process.env.PORT || 4000;
  
  httpServer.listen(PORT, () => {
    console.log(`🚀 Task Service (GraphQL) running on port ${PORT}`);
    console.log(`🔌 GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`📡 Subscriptions ready at ws://localhost:${PORT}${server.graphqlPath}`);
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      service: 'task-service-graphql',
      timestamp: new Date().toISOString(),
      data: {
        tasks: tasks.length
      }
    });
  });
}

startServer().catch(error => {
  console.error('Failed to start GraphQL server:', error);
  process.exit(1);
});