const { verifySupabaseToken, getUserProfile } = require('../utils/supabaseAuth');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const user = await verifySupabaseToken(token);
    const profile = await getUserProfile(user.id);
    
    req.user = {
      id: user.id,
      email: user.email,
      ...profile
    };
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const user = await verifySupabaseToken(token);
      const profile = await getUserProfile(user.id);
      
      req.user = {
        id: user.id,
        email: user.email,
        ...profile
      };
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuth
};