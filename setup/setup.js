var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var expressValidator = require('express-validator');
var flash = require('express-flash');
var session = require('express-session');
// var nodemailer = require('nodemailer');
var hbs = require('hbs');
var compression = require('compression');
var crypto = require('crypto');

var debug = require('debug')('cellar:server');
var http = require('http');

var User = require('../models/User.js');

var app = express();
module.exports = app;

var mongoose = require('mongoose');

// view engine setup
app.set('views', path.join(__dirname, '../', 'views'));
app.set('view engine', 'hbs');
hbs.localsAsTemplateData(app);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(expressValidator());
app.use(session({secret: crypto.randomBytes(20).toString('hex'), name: 'session_id', saveUninitialized: true, resave: true}));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(compression());
app.use(flash());

app.use(function (req, res, next) {
  res.removeHeader('x-powered-by');
  res.locals.user = req.user;
  res.locals.url = req.protocol + '://' + req.get('host') + req.originalUrl;
  next();
});

var router = express.Router();

router.get('/', function (req, res, next) {
  res.redirect('/setup');
});

router.get('/setup', function (req, res, next) {
  res.render('setup', {
    step: 'instructions',
    layout: 'setuplayout.hbs'
  });
});

router.post('/setup', function (req, res, next) {
  res.redirect('/setup/title');
});

router.get('/setup/title', function (req, res, next) {
  res.render('setup', {
    step: 'title',
    layout: 'setuplayout.hbs'
  });
});

router.post('/setup/title', function (req, res, next) {
  req.assert('title', 'Website Title cannot be empty').notEmpty();

  var errors = req.validationErrors();
  if (errors) {
    req.flash('error', errors);
    return res.redirect('/setup/title');
  }

  app.locals.SITE_TITLE = req.body.title;
  res.redirect('/setup/database');
});

router.get('/setup/database', function (req, res, next) {
  res.render('setup', {
    step: 'database',
    layout: 'setuplayout.hbs'
  });
});

router.post('/setup/database', function (req, res, next) {
  req.assert('database', 'MongoDB Url cannot be empty').notEmpty();
  req.assert('database', 'MongoDB Url is not valid').isURL({
    protocols: ['mongodb'],
    require_tld: false,
    require_protocol: true,
    require_host: true,
    require_valid_protocol: true,
    allow_underscores: false,
    host_whitelist: false,
    host_blacklist: false,
    allow_trailing_dot: false,
    allow_protocol_relative_urls: false
  });

  var errors = req.validationErrors();

  if (errors) {
    req.flash('error', errors);
    return res.redirect('/setup/database');
  }

  app.locals.MONGODB = req.body.database;

  mongoose.connect(app.locals.MONGODB);

  app.locals.db = mongoose.connection;
  app.locals.db.once('error', function () {
    app.locals.db.close();
    req.flash('error', {
      msg: 'Failed to connect to MongoDB.'
    });
    return res.redirect('/setup/database');
  });
  app.locals.db.once('open', function () {
    req.flash('success', {
      msg: 'Successfully connected to MongoDB.'
    });
    return res.redirect('/setup/mail');
  });
});

router.get('/setup/mail', function (req, res, next) {
  res.render('setup', {
    step: 'mail',
    layout: 'setuplayout.hbs'
  });
});

router.post('/setup/mail', function (req, res, next) {
  req.assert('host', 'SMTP Host cannot be empty').notEmpty();
  req.assert('port', 'SMTP Port cannot be empty').notEmpty();
  req.assert('port', 'SMTP Port must be an int').isInt();
  req.assert('username', 'SMTP Username cannot be empty').notEmpty();
  req.assert('username', 'SMTP Username must be a valid email address').isEmail();
  req.assert('pass', 'SMTP Password cannot be empty').notEmpty();

  var errors = req.validationErrors();

  if (errors) {
    req.flash('error', errors);
    return res.redirect('/setup/database');
  }
});

router.get('/setup/auth', function (req, res, next) {
  res.render('setup', {
    step: 'auth',
    layout: 'setuplayout.hbs'
  });
});

router.post('/setup/auth', function (req, res, next) {
  req.assert('username', 'Username cannot be blank').notEmpty();
  req.assert('username', 'Username is not valid').isAscii();
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
    return res.redirect('/setup/auth');
  }

  User.findOne(
    {
      email: req.body.email
    },
    function (err, user) {
      if (err) {

      }
      if (user) {
        req.flash('error', {
          msg: 'The email address you have entered is already associated with another account.'
        });
        return res.redirect('/setup/auth');
      }
      user = new User({
        username: req.body.username,
        email: req.body.email,
        password: req.body.password
      });
      user.save(function (err) {
        if (err) {
          console.error(err);
        }
        res.redirect('/setup/done');
      });
    });
});

router.get('/setup/final', function (req, res, next) {
  res.render('setup', {
    step: 'final',
    layout: 'setuplayout.hbs'
  });
});

router.post('/setup/final', function (req, res, next) {
  crypto.randomBytes(20, function (err, buf) {
    if (err) {
      req.flash('error', {
        msg: 'Failed to generate session secret.'
      });
      return res.redirect('/setup/smtp');
    }
    var token = buf.toString('hex');
    var config = 'SITE_TITLE=' + app.locals.SITE_TITLE + '\nMONGODB=' + app.locals.MONGODB +
    '\nSESSION_SECRET=' + token + '\nSMTP_HOST=' + req.body.host + '\nSMTP_PORT=' + req.body.port +
    '\nSMTP_USE_TLS=' + req.body.tls + '\nSMTP_USER=' + req.body.user + '\nSMTP_PASS=' + req.body.pass;

    var fs = require('fs');
    fs.writeFile('.env', config, function (err) {
      if (err) {
        req.flash('error', {
          msg: 'Failed to save values to config file.'
        });
        return res.redirect('/setup/final');
      }

      return res.redirect('/setup/done');
    });
  });
});

router.get('/setup/done', function (req, res, next) {
  res.render('setup', {
    step: 'done',
    layout: 'setuplayout.hbs'
  });
});

router.post('/setup/done', function (req, res, next) {
  server.close();
});

app.use('/', router);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

hbs.registerHelper('is', function (a, b, options) {
  if (a === b) {
    return options.fn(this);
  }
  return options.inverse(this);
});

hbs.registerHelper('isnot', function (a, b, options) {
  if (a !== b && a !== undefined && b !== undefined) {
    return options.fn(this);
  }
  return options.inverse(this);
});

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort (val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError (error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break; // eslint-disable-line
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break; // eslint-disable-line
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening () {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
