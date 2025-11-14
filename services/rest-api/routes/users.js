const express = require('express');
const { validateUserUpdate } = require('../middleware/validation');
// Kita akan buat file 'authMiddleware' ini di langkah berikutnya
const { authenticate, isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/users - Get all users
router.get('/', (req, res) => {
  const { role, search } = req.query;
  
  // Pastikan global.users ada
  let filteredUsers = global.users ? [...global.users] : [];
  
  // Filter by role
  if (role) {
    filteredUsers = filteredUsers.filter(user => user.role === role);
  }
  
  // Search by name or email
  if (search) {
    filteredUsers = filteredUsers.filter(user => 
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  // Fungsi untuk menghapus passwordHash dari user object
  const stripPassword = (user) => {
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  };

  // Terapkan penghapusan password ke semua user yang akan dikirim
  filteredUsers = filteredUsers.map(stripPassword);
  
  res.json(filteredUsers);
});

// GET /api/users/:id - Get user by ID
router.get('/:id', (req, res) => {
  if (!global.users) {
    return res.status(500).json({ error: 'User data not initialized' });
  }
  
  const user = global.users.find(u => u.id === req.params.id);
  
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: `User with ID ${req.params.id} does not exist`
    });
  }
  
  // Hapus passwordHash sebelum mengirim
  const { passwordHash, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// PUT /api/users/:id - Update user (data diri sendiri)
router.put('/:id', validateUserUpdate, (req, res) => {
    // Cek apakah user yang mau di-edit adalah user yang sedang login
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden. You can only update your own profile.' });
    }

    const userIndex = global.users.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Hanya boleh update nama
    const { name } = req.body;
    if (name) {
        global.users[userIndex].name = name;
    }
    
    const { passwordHash, ...userWithoutPassword } = global.users[userIndex];
    res.status(200).json(userWithoutPassword);
});


// PUT /api/users/:id/role - Ubah role user (HANYA ADMIN)
router.put('/:id/role', isAdmin, (req, res) => { // <-- PASANG 'isAdmin'
  const { role } = req.body;
  if (!role || (role !== 'admin' && role !== 'user')) {
    return res.status(400).json({ error: "Invalid role. Must be 'admin' or 'user'." });
  }

  if (!global.users) {
    return res.status(500).json({ error: 'User data not initialized' });
  }

  const userIndex = global.users.findIndex(u => u.id === req.params.id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  global.users[userIndex].role = role;
  
  const { passwordHash, ...userWithoutPassword } = global.users[userIndex];
  res.json({
    message: 'User role updated successfully',
    user: userWithoutPassword
  });
});

// DELETE /api/users/:id - Delete user (HANYA ADMIN)
router.delete('/:id', isAdmin, (req, res) => {
  if (!global.users) {
    return res.status(500).json({ error: 'User data not initialized' });
  }
  
  // Cek agar admin tidak bisa hapus diri sendiri
  if (req.user.id === req.params.id) {
    return res.status(400).json({ error: 'Admin cannot delete self.' });
  }

  const userIndex = global.users.findIndex(u => u.id === req.params.id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const deletedUser = global.users.splice(userIndex, 1)[0];
  
  // Hapus passwordHash sebelum mengirim
  const { passwordHash, ...userWithoutPassword } = deletedUser;
  res.json({
    message: 'User deleted successfully',
    user: userWithoutPassword
  });
});

module.exports = router;