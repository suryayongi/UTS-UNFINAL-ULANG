const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { validateUser, validateLogin } = require('../middleware/validation');

const router = express.Router();

// --- PRE-BUILD AKUN DI SINI ---
// Kita buat ini 'global' agar bisa diakses file rute lain
if (!global.users) {
  global.users = [
    {
      id: '1',
      name: 'Admin User',
      email: 'admin@example.com',
      // Ini adalah hash dari "password123"
      passwordHash: '$2a$12$D.Iq.f.FR.0.Y.xNA.3E/ey.h.M0rFpMIF9S/dpg2l.WJOPCqS5qO', 
      role: 'admin',
      teams: ['t1'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Normal User',
      email: 'user@example.com',
      // Ini adalah hash dari "password123"
      passwordHash: '$2a$12$D.Iq.f.FR.0.Y.xNA.3E/ey.h.M0rFpMIF9S/dpg2l.WJOPCqS5qO',
      role: 'user',
      teams: ['t1'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}
// ---------------------------------

// Membaca private key untuk *membuat* token
// (Pastikan nama file-nya jwtRS256.key)
const privateKey = fs.readFileSync(path.join(__dirname, '../jwtRS256.key'), 'utf8');

// POST /api/auth/register - Registrasi user baru
router.post('/register', validateUser, async (req, res) => {
  const { name, email, password, role = 'user' } // Ambil 'role' dari request
  
  if (global.users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'Email already exists' });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const newUser = {
    id: uuidv4(),
    name,
    email,
    passwordHash,
    role: role, // Terapkan role yang di-request
    teams: ['t1'], // Otomatis masukkan ke tim 't1'
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  global.users.push(newUser);

  res.status(201).json({
    message: `User created successfully${role === 'admin' ? ' as ADMIN' : ''}`,
    user: { id: newUser.id, name: newUser.name, email: newUser.email }
  });
});

// POST /api/auth/login - Login user
router.post('/login', validateLogin, async (req, res) => {
  const { email, password } = req.body;

  // Cari user
  const user = global.users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials (user not found)' });
  }

  // Cek password
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials (password mismatch)' });
  }

  // Buat JWT Token
  const payload = {
    id: user.id, // ID diganti dari userId
    email: user.email,
    name: user.name,
    role: user.role,
    teams: user.teams
  };

  // Buat token menggunakan private key, berlaku 1 jam
  const token = jwt.sign(
    payload,
    privateKey,
    { algorithm: 'RS256', expiresIn: '1h' }
  );

  res.json({
    message: 'Login successful',
    token: token
  });
});

// GET /api/auth/public-key - Endpoint untuk API Gateway (nanti)
router.get('/public-key', (req, res) => {
  try {
    // Baca file public key yang sudah kita buat
    const publicKey = fs.readFileSync(path.join(__dirname, '../jwtRS256.key.pub'), 'utf8');
    res.type('text/plain').send(publicKey);
  } catch (err) {
    console.error("Could not read public key", err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;