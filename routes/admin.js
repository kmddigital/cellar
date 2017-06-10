var express = require('express');
var router = express.Router();

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

/* GET Admin Page */
router.get('/', isAuthenticated, function (req, res) {
  res.render('admin', {layout: 'adminlayout.hbs'});
});

module.exports = router;
