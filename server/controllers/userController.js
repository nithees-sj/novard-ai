const User = require('../models/user');

exports.saveUser = async (req, res) => {
  const { name, email, picture } = req.body;
  console.log(req.body);

  try {
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({ name, email, picture });
      await user.save();
      return res.status(201).json({ message: 'User created', user });
    } else {
      return res.status(200).json({ message: 'User already exists', user });
    }
  } catch (error) {
    console.error('Error saving user:', error);
    return res.status(500).send('Error saving user');
  }
};

exports.getUserByEmail = async (req, res) => {
  const { email } = req.params;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Error retrieving user:', error);
    return res.status(500).send('Error retrieving user');
  }
};

// Get user profile by email
exports.getUserProfile = async (req, res) => {
  const { email } = req.query;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      name: user.name,
      email: user.email,
      picture: user.picture,
      mobile: user.mobile || '',
      bio: user.bio || ''
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Error fetching user profile' });
  }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
  const { email, name, mobile, bio } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update fields
    if (name) user.name = name;
    if (mobile !== undefined) user.mobile = mobile;
    if (bio !== undefined) user.bio = bio;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        name: user.name,
        email: user.email,
        picture: user.picture,
        mobile: user.mobile,
        bio: user.bio
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ error: 'Error updating user profile' });
  }
};