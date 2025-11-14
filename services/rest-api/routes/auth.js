const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { validateUser, validateLogin } = require('../middleware/validation');

const router = express.Router();

// In-memory database (ganti dengan database sungguhan di produksi)
const users = [];
let userIdCounter = 1;

// --- Helper untuk sign token ---
function signToken(user) {
  // Membaca kunci PRIVAT yang kamu generate
  const privateKeyPath = path.join(__dirname, '..', process.env.PRIVATE_KEY_PATH);
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
}

// POST /api/auth/register - Registrasi user baru
router.post('/register', validateUser, async (req, res) => {
  const { name, email, password, role = 'user' } = req.body;

  // Cek jika email sudah ada
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(409).json({
      error: 'Email already exists',
      message: 'A user with this email already exists'
    });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  const newUser = {
    id: (userIdCounter++).toString(),
    name,
    email,
    password: hashedPassword, // Simpan hash, bukan password asli
    role, // 'user' atau 'admin'
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);

  // Buat token
  const token = signToken(newUser);

  res.status(201).json({
    message: 'User registered successfully',
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    }
  });
});

// POST /api/auth/login - Login user
router.post('/login', validateLogin, async (req, res) => {
  const { email, password } = req.body;

  // Cari user
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Cek password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Buat token
  const token = signToken(user);

  res.status(200).json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

module.exports = router;