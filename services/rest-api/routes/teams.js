const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { validateTeam } = require('../middleware/validation');
const router = express.Router();

// Database tim in-memory (sesuai dengan data di auth.js)
let teams = [
  { id: 't1', name: 'Task Management Team', members: ['1', '2'] }, // '1' dan '2' adalah ID user dari global.users
];

// GET /api/teams - Dapatkan semua tim
router.get('/', (req, res) => {
  // Rute ini dilindungi, kita bisa akses req.user dari middleware
  const userTeams = teams.filter(team => team.members.includes(req.user.id));
  res.json(userTeams);
});

// POST /api/teams - Buat tim baru
router.post('/', validateTeam, (req, res) => {
  const { name } = req.body;
  const creatorId = req.user.id; // Dapatkan ID pembuat dari token

  const newTeam = {
    id: uuidv4(),
    name,
    members: [creatorId] // Otomatis tambahkan pembuatnya
  };

  teams.push(newTeam);
  res.status(201).json(newTeam);
});

// Anda bisa tambahkan endpoint lain nanti:
// GET /api/teams/:id - Dapat 1 tim
// POST /api/teams/:id/members - Tambah anggota

module.exports = router;