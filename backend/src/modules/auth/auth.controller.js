const { registerUser, loginUser, changePassword } = require('./auth.service');

const {
  rotateRefreshToken,
  revokeAuthSession,
  revokeAllUserSessions,
} = require('./session.service');

const {
  validateRegistrationInput,
  validateLoginInput,
  validatePassword,
} = require('./auth.validation');

async function register(req, res, next) {
  try {
    const validation = validateRegistrationInput(req.body);

    const result = await registerUser({
      ...validation.data,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const validation = validateLoginInput(req.body);

    const result = await loginUser({
      ...validation.data,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    const result = await rotateRefreshToken({
      refreshToken,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;

    await revokeAuthSession({
      refreshToken,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

async function changePasswordHandler(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      const error = new Error('Current password and new password are required');

      error.statusCode = 400;
      error.code = 'PASSWORD_FIELDS_REQUIRED';

      throw error;
    }

    const passwordValidation = validatePassword(newPassword);

    if (!passwordValidation.valid) {
      const error = new Error(passwordValidation.message);

      error.statusCode = 400;
      error.code = 'INVALID_PASSWORD';

      throw error;
    }

    const result = await changePassword({
      userId: req.user.id,
      currentPassword,
      newPassword,
    });

    await revokeAllUserSessions(req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please sign in again.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  changePasswordHandler,
};
