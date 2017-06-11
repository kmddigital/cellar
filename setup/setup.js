var fs = require('fs');

fs.stat('.env', function (err, stat) {
  if (err == null) {
    console.log('[' + chalk.bold.red('Error') + '] Cellar is already setup');
    process.exit(0);
  } else if (err.code !== 'ENOENT') {
    console.log('[' + chalk.bold.red('Error') + ']' + err);
    process.exit(0);
  }
});

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
var publicIp = require('public-ip');
var chalk = require('chalk');

var debug = require('debug')('cellar:server');
var http = require('http');

var User = require('../models/User.js');

var app = express();
module.exports = app;

var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

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
  if (app.locals.SITE_TITLE) {
    res.render('setup', {
      step: 'database',
      layout: 'setuplayout.hbs'
    });
  } else {
    res.redirect('/setup/');
  }
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

  let sent = false; // hack to prevent sending multiple responses
  app.locals.db.once('error', function () {
    if (!sent) {
      sent = true;
      app.locals.db.close();
      req.flash('error', {
        msg: 'Failed to connect to MongoDB.'
      });
      return res.redirect('/setup/database');
    }
  });
  app.locals.db.once('open', function () {
    if (!sent) {
      return res.redirect('/setup/mail');
    }
  });
});

router.get('/setup/mail', function (req, res, next) {
  if (app.locals.SITE_TITLE && app.locals.MONGODB) {
    res.render('setup', {
      step: 'mail',
      layout: 'setuplayout.hbs'
    });
  } else {
    res.redirect('/setup/');
  }
});

router.post('/setup/mail', function (req, res, next) {
  req.assert('smtphost', 'SMTP Host cannot be empty').notEmpty();
  req.assert('smtpport', 'SMTP Port cannot be empty').notEmpty();
  req.assert('smtpport', 'SMTP Port must be an int').isInt();
  req.assert('smtpusername', 'SMTP Username cannot be empty').notEmpty();
  req.assert('smtpusername', 'SMTP Username must be a valid email address').isEmail();
  req.assert('smtppassword', 'SMTP Password cannot be empty').notEmpty();

  var errors = req.validationErrors();

  if (errors) {
    req.flash('error', errors);
    return res.redirect('/setup/mail');
  }

  app.locals.SMTP_HOST = req.body.smtphost;
  app.locals.SMTP_PORT = req.body.smtpport;
  app.locals.SMTP_USE_TLS = req.body.smtptls === 'on' ? 'true' : 'false';
  app.locals.SMTP_USER = req.body.smtpusername;
  app.locals.SMTP_PASS = req.body.smtppassword;

  res.redirect('/setup/auth');
});

router.get('/setup/auth', function (req, res, next) {
  if (app.locals.SITE_TITLE && app.locals.MONGODB && app.locals.SMTP_HOST) {
    res.render('setup', {
      step: 'auth',
      layout: 'setuplayout.hbs'
    });
  } else {
    res.redirect('/setup/');
  }
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

  User.findOne({
    email: req.body.email
  }, function (err, user) {
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
      password: req.body.password,
      role: 'admin'
    });
    user.save(function (err) {
      if (err) {
        console.error(err);
      }
      res.redirect('/setup/final');
    });
  });
});

router.get('/setup/final', function (req, res, next) {
  if (app.locals.SITE_TITLE && app.locals.MONGODB && app.locals.SMTP_HOST) {
    res.render('setup', {
      step: 'final',
      layout: 'setuplayout.hbs'
    });
  } else {
    res.redirect('/setup/');
  }
});

router.post('/setup/final', function (req, res, next) {
  crypto.randomBytes(20, function (err, buf) {
    if (err) {
      req.flash('error', {
        msg: 'Failed to generate session secret.'
      });
      return res.redirect('/setup/final');
    }

    var token = buf.toString('hex');
    var config = 'SITE_TITLE="' + app.locals.SITE_TITLE + '"\nMONGODB="' + app.locals.MONGODB +
    '"\nSESSION_SECRET="' + token + '"\nSMTP_HOST="' + app.locals.SMTP_HOST + '"\nSMTP_PORT="' + app.locals.SMTP_PORT +
    '"\nSMTP_USE_TLS="' + app.locals.SMTP_USE_TLS + '"\nSMTP_USER="' + app.locals.SMTP_USER + '"\nSMTP_PASS="' + app.locals.SMTP_PASS + '"';

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
  fs.stat('.env', function (err, stat) {
    if (err == null) {
      res.render('setup', {
        step: 'done',
        layout: 'setuplayout.hbs'
      });
    } else {
      res.redirect('/setup/');
    }
  });
});

router.post('/setup/done', function (req, res, next) {
  console.log();
  console.log(chalk.bold.green('Nice!'));
  console.log('There are just a few more steps you need to complete yourself:');
  console.log(chalk.bold.green('1') + '. Enter the following ' + chalk.bold.yellow('command') + ' in your terminal: ' +
  chalk.bold.cyan.underline('npm start'));
  publicIp.v4().then(ip => {
    console.log(chalk.bold.green('2') + '. Visit ' + chalk.bold.yellow('one') + ' of the following IPs in your web browser:');
    console.log('  ' + chalk.bold.green('Locally') + ': ' + chalk.bold.cyan('127.0.0.1:3000'));
    console.log('  ' + chalk.bold.green('Externally') + ': ' + chalk.bold.cyan(ip + ':3000'));
    server.close();
    process.exit(0);
  });
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

server.listen(port, '0.0.0.0');
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
  publicIp.v4().then(ip => {
    console.log('Welcome to ' + chalk.magenta.bold('Cellar') + '!');
    console.log('Visit ' + chalk.bold.yellow('one') + ' of the following IPs in your web browser to begin setup:');
    console.log('  ' + chalk.bold.green('Locally') + ': ' + chalk.bold.cyan('127.0.0.1:3000'));
    console.log('  ' + chalk.bold.green('Externally') + ': ' + chalk.bold.cyan(ip + ':3000'));
  });
}
