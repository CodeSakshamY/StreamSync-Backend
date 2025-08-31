// This file is no longer needed as we use Supabase Auth tokens
// Keeping for backward compatibility if needed

const { verifySupabaseToken } = require('./supabaseAuth');

// Legacy function that now uses Supabase
const verifyToken = async (token) => {
  return verifySupabaseToken(token);
};

module.exports = {
  verifyToken
};