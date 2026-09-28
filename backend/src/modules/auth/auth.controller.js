const { registerUser } = require('./auth.service');
const { validateRegistrationInput } = require('./auth.validation');

async function register(req, res, next) {
  try {
    const validation = validateRegistrationInput(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid registration data',
          fields: validation.errors,
        },
      });
    }

    const result = await registerUser(validation.data);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
};
