var mongoose = require('mongoose');

var userSchema = mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true
  },
  password: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserRole'
  }
});

module.exports = mongoose.model('User', userSchema);
