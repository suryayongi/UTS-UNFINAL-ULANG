require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');


const authRoutes = require('./routes/auth'); // File baru untuk login/register
const usersRoutes = require('./routes/users'); // File lama kamu (JANGAN DIHAPUS)


const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'User Service (REST API)',
    timestamp: new Date().toISOString()
  });
});


app.use('/api/auth', authRoutes); // Rute baru untuk login/register
app.use('/api/users', usersRoutes); // Rute lama kamu untuk CRUD user


// --- Public Key Endpoint ---
// Endpoint ini akan dipanggil oleh API Gateway untuk verifikasi token
app.get('/api/auth/public-key', (req, res) => {
  try {
    const publicKeyPath = path.join(__dirname, 'jwtRS256.key.pub');
    const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
    res.setHeader('Content-Type', 'application/x-pem-file');
    res.status(200).send(publicKey);
  } catch (error) {
    console.error("Error reading public key:", error);
    res.status(500).json({ error: "Could not retrieve public key." });
  }
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 User Service (REST API) running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Public Key available at: http://localhost:${PORT}/api/auth/public-key`);
});

module.exports = app;