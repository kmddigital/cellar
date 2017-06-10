var mongoose = require('mongoose');

var userRoleSchema = mongoose.Schema({
  permissions: [String]
});

userRoleSchema.methods.hasPermission = function (perm) {
  return this.permissions.indexOf(perm) !== -1;
};

module.exports = mongoose.model('UserRole', userRoleSchema);
