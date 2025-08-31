const { supabaseAdmin } = require('../config/supabase');

const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if username is already taken
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (existingProfile) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ message: authError.message });
    }

    // Create user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        username,
        email,
        avatar: '',
        is_online: false,
        preferences: {
          notifications: true,
          dark_mode: false
        }
      })
      .select()
      .single();

    if (profileError) {
      // Clean up auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ message: 'Error creating user profile' });
    }

    // Generate session for the user
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        avatar: profile.avatar,
        preferences: profile.preferences,
        created_at: profile.created_at
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      return res.status(500).json({ message: 'Error fetching user profile' });
    }

    // Update user online status
    await supabaseAdmin
      .from('profiles')
      .update({ 
        is_online: true,
        last_seen: new Date().toISOString()
      })
      .eq('id', authData.user.id);

    res.json({
      message: 'Login successful',
      token: authData.session.access_token,
      user: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        avatar: profile.avatar,
        is_online: true,
        preferences: profile.preferences,
        last_seen: profile.last_seen,
        created_at: profile.created_at
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error during login' });
  }
};

const logout = async (req, res) => {
  try {
    // Update user offline status
    await supabaseAdmin
      .from('profiles')
      .update({
        is_online: false,
        last_seen: new Date().toISOString()
      })
      .eq('id', req.user.id);

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Error during logout' });
  }
};

const getProfile = async (req, res) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.json({ user: profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Error fetching profile' });
  }
};

module.exports = {
  signup,
  login,
  logout,
  getProfile
};