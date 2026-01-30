const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  picture: String,
  mobile: String,
  bio: String,
});

module.exports = mongoose.model('User', userSchema);
