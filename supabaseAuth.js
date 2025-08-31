const { supabaseAdmin } = require('../config/supabase');

const verifySupabaseToken = async (token) => {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      throw new Error('Invalid token');
    }

    return user;
  } catch (error) {
    throw new Error('Token verification failed');
  }
};

const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error('Failed to fetch user profile');
  }
};

module.exports = {
  verifySupabaseToken,
  getUserProfile
};