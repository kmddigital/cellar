var express = require('express');
var passport = require('passport');
var async = require('async');
var crypto = require('crypto');
var User = require('../models/User');
var cellar = require('../cellar');
var router = express.Router();

/* GET login */
router.get('/login', function (req, res, next) {
  res.render('login',
    {
      title: 'Login',
      backgroundColor: '#F06449',
      layout: 'authlayout.hbs'
    });
});

/* POST login */
router.post('/login', function (req, res, next) {
  req.assert('email', 'Email is not valid').isEmail();
  req.assert('email', 'Email cannot be blank').notEmpty();
  req.assert('password', 'Password cannot be blank').notEmpty();
  req.sanitize('email').normalizeEmail(
    {
      remove_dots: false
    });

  var errors = req.validationErrors();

  if (errors) {
    req.flash('error', errors);
    return isUndf(req.query.return) ? res.redirect('/login') : res.redirect('/login?return=' + req.query.return);
  }

  passport.authenticate('local', function (err, user, info) {
    if (!user || err) {
      req.flash('error', info);
      return isUndf(req.query.return) ? res.redirect('/login') : res.redirect('/login?return=' + req.query.return);
    }
    req.logIn(user, function (err) {
      if (err) {
        console.error(err);
      }
      res.redirect(isUndf(req.query.return) ? '/' : req.query.return);
    });
  })(req, res, next);
});

/* GET register */
router.get('/register', function (req, res, next) {
  if (req.user) {
    return res.redirect('/dashboard');
  } else {
    res.render('register',
      {
        title: 'Register',
        backgroundColor: '#F06449',
        layout: 'authlayout.hbs'
      });
  }
});

/* POST register */
router.post('/register', function (req, res, next) {
  req.assert('name', 'Name cannot be blank').notEmpty();
  req.assert('email', 'Email is not valid').isEmail();
  req.assert('email', 'Email cannot be blank').notEmpty();
  req.assert('password', 'Password must be at least 4 characters long').len(4);
  req.sanitize('email').normalizeEmail(
    {
      remove_dots: false
    });

  var errors = req.validationErrors();

  if (errors) {
    req.flash('error', errors);
    return res.redirect('/register');
  }

  User.findOne(
    {
      email: req.body.email
    }, function (err, user) {
    if (user || err) {
      req.flash('error',
        {
          msg: 'The email address you have entered is already associated with another account.'
        });
      return res.redirect('/register');
    }
    user = new User(
      {
        username: req.body.name,
        email: req.body.email,
        password: req.body.password
      });
    user.save(function (err) {
      if (err) {
        console.error(err);
      }
      req.logIn(user, function (err) {
        if (err) {
          console.error(err);
        }
        res.redirect('/');
      });
    });
  });
});

/* GET forgot */
router.get('/forgot', function (req, res) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.render('forgot',
    {
      title: 'Forgot Password',
      backgroundColor: '#F06449',
      layout: 'authlayout.hbs'
    });
});

/* POST forgot */
router.post('/forgot', function (req, res, next) {
  req.assert('email', 'Email is not valid').isEmail();
  req.assert('email', 'Email cannot be blank').notEmpty();
  req.sanitize('email').normalizeEmail(
    {
      remove_dots: false
    });

  var errors = req.validationErrors();

  if (errors) {
    req.flash('error', errors);
    return res.redirect('/forgot');
  }

  async.waterfall([
    function (done) {
      crypto.randomBytes(16, function (err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function (token, done) {
      User.findOne(
        {
          email: req.body.email
        }, function (err, user) {
        if (err) {
          console.error(err);
        }
        if (!user) {
          req.flash('error',
            {
              msg: 'The email address ' + req.body.email + ' is not associated with any account.'
            });
          return res.redirect('/forgot');
        }
        user.passwordResetToken = token;
        user.passwordResetExpires = Date.now() + 3600000; // expire in 1 hour
        user.save(function (err) {
          done(err, token, user);
        });
      });
    },
    function (token, user, done) {
      var mailOptions = {
        to: user.email,
        subject: 'Reset your password on ' + cellar.locals.name,
        text: 'You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n',
        html: 'You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      cellar.locals.mailer.sendMail(mailOptions, function (err) {
        if (err) {
          req.flash('error', {
            msg: 'Failed to send email, please try again later.'
          });
        }
        req.flash('info',
          {
            msg: 'An email has been sent to the requested email with further instructions.'
          });
        res.redirect('/forgot');
      });
    }
  ]);
});

/* GET reset/:token */
router.get('/reset/:token', function (req, res) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  User.findOne(
    {
      passwordResetToken: req.params.token
    })
    .where('passwordResetExpires').gt(Date.now())
    .exec(function (err, user) {
      if (err) {
        console.error(err);
      }
      if (!user) {
        req.flash('error',
          {
            msg: 'Password reset token is invalid or has expired.'
          });
        return res.redirect('/forgot');
      }
      res.render('reset',
        {
          title: 'Password Reset',
          backgroundColor: '#F06449',
          layout: 'authlayout.hbs'
        });
    });
});

/* POST reset/:token */
router.post('/reset/:token', function (req, res, next) {
  req.assert('password', 'Password must be at least 8 characters long').len(8);
  req.assert('confirm', 'Passwords must match').equals(req.body.password);

  var errors = req.validationErrors();

  if (errors) {
    req.flash('error', errors);
    return res.redirect('back');
  }

  async.waterfall([
    function (done) {
      User.findOne(
        {
          passwordResetToken: req.params.token
        })
        .where('passwordResetExpires').gt(Date.now())
        .exec(function (err, user) {
          if (err) {
            console.error(err);
          }
          if (!user) {
            req.flash('error',
              {
                msg: 'Password reset token is invalid or has expired.'
              });
            return res.redirect('back');
          }
          user.password = req.body.password;
          user.passwordResetToken = undefined;
          user.passwordResetExpires = undefined;
          user.save(function (err) {
            if (err) {
              console.error(err);
            }
            req.logIn(user, function (err) {
              done(err, user);
            });
          });
        });
    },
    function (user, done) {
      var mailOptions = {
        to: user.email,
        subject: '✔ Your ' + cellar.locals.name + ' password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n',
        html: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      cellar.sendMail(mailOptions, function (err) {
        if (err) {
          console.error(err);
        }
        req.flash('success',
          {
            msg: 'Your password has been changed successfully.'
          });
        res.redirect('/account');
      });
    }
  ]);
});

/* GET logout */
router.get('/logout', function (req, res) {
  req.logout();
  res.redirect('/');
});

function isUndf (obj) {
  return obj === undefined || obj === null;
}

module.exports = router;
