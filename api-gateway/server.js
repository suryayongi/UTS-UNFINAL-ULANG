const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// HAPUS: require('express-jwt');
// HAPUS: require('jwks-rsa');
require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 3000;
const REST_API_URL = process.env.REST_API_URL || 'http://localhost:3001';
const GRAPHQL_API_URL = process.env.GRAPHQL_API_URL || 'http://localhost:4000';

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3002', // Frontend
    'http://localhost:3000', // Gateway itself
    'http://frontend-app:3002' // Docker container name
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// --- HAPUS SEMUA LOGIC 'checkJwt' ---

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      'user-service': REST_API_URL,
      'task-service': GRAPHQL_API_URL
    }
  });
});

// --- Proxy Definitions ---

// HAPUS 'onProxyReq' (kita tidak butuh X-User-Payload lagi)

// Proxy error handler
const onError = (err, req, res, target) => {
  console.error(`Proxy Error: ${err.message}`);
  res.status(503).json({
    error: 'Service unavailable',
    message: `Could not connect to ${target.href}`
  });
};

// Proxy configuration for REST API (User Service)
const restApiProxy = createProxyMiddleware({
  target: REST_API_URL,
  changeOrigin: true,
  // HAPUS: onProxyReq,
  onError: (err, req, res) => onError(err, req, res, { href: REST_API_URL }),
});

// Proxy configuration for GraphQL API (Task Service)
const graphqlApiProxy = createProxyMiddleware({
  target: GRAPHQL_API_URL,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying for subscriptions
  // HAPUS: onProxyReq,
  onError: (err, req, res) => onError(err, req, res, { href: GRAPHQL_API_URL }),
});

// Terapkan proxy (TANPA 'checkJwt')
app.use('/api', restApiProxy); 
app.use('/graphql', graphqlApiProxy); 

// --- HAPUS 'app.use((err, req, res, next) => { ... })' ---
// (Error handling token sekarang ada di service)

// Catch-all 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔄 Proxying /api/* to: ${REST_API_URL}`);
  console.log(`🔄 Proxying /graphql to: ${GRAPHQL_API_URL}`);
});

// Handle upgrade (websockets) untuk subscriptions GraphQL
server.on('upgrade', (req, socket, head) => {
  console.log('[API Gateway] Upgrading WebSocket connection for GraphQL');
  graphqlApiProxy.ws(req, socket, head);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;