const Joi = require('joi');

// Skema validasi registrasi
const userSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'user').optional()
});

// Skema validasi login
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Middleware validasi untuk registrasi
const validateUser = (req, res, next) => {
  const { error } = userSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      message: error.details[0].message,
      details: error.details
    });
  }
  
  next();
};

// Middleware validasi untuk login
const validateLogin = (req, res, next) => {
  const { error } = loginSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      message: error.details[0].message,
      details: error.details
    });
  }
  
  next();
};

// Kita biarkan validasi user lama, walau tidak terpakai
const validateUserUpdate = (req, res, next) => {
  const userUpdateSchema = Joi.object({
    name: Joi.string().min(2).max(50).optional(),
    email: Joi.string().email().optional(),
    age: Joi.number().integer().min(0).optional()
  });

  const { error } = userUpdateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      message: error.details[0].message
    });
  }
  next();
};


module.exports = {
  validateUser,
  validateLogin,
  validateUserUpdate // Tetap ekspor ini agar users.js tidak error
};