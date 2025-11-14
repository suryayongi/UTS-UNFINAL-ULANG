const Joi = require('joi');

// Skema validasi registrasi (dipakai auth.js)
const userSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'user').optional()
});

// Skema validasi login (dipakai auth.js)
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Skema validasi update user (dipakai users.js)
const userUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
}).min(1); // Harus ada minimal 1 field

// Skema validasi tim (dipakai teams.js)
const teamSchema = Joi.object({
    name: Joi.string().min(3).max(100).required()
});

// Middleware
const validateUser = (req, res, next) => {
  const { error } = userSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: 'Validation error', message: error.details[0].message });
  }
  next();
};

const validateLogin = (req, res, next) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: 'Validation error', message: error.details[0].message });
  }
  next();
};

const validateUserUpdate = (req, res, next) => {
  const { error } = userUpdateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: 'Validation error', message: error.details[0].message });
  }
  next();
};

const validateTeam = (req, res, next) => {
    const { error } = teamSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: 'Validation error', message: error.details[0].message });
    }
    next();
};

module.exports = {
  validateUser,
  validateLogin,
  validateUserUpdate,
  validateTeam
};