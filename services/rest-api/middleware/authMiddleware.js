const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Kita baca KUNCI PUBLIK untuk verifikasi
const publicKeyPath = path.join(__dirname, '..', 'jwtRS256.key.pub');
const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

// Middleware untuk memverifikasi token
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verifikasi token menggunakan KUNCI PUBLIK
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    
    // Simpan data user di request agar bisa dipakai oleh rute selanjutnya
    req.user = decoded; 
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
};

// Middleware untuk mengecek apakah user adalah admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ error: 'Forbidden', message: 'Requires admin role' });
  }
};

module.exports = {
  authenticate,
  isAdmin
};