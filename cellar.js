require('dotenv-safe').load();
var env = process.env;

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var expressValidator = require('express-validator');
var flash = require('express-flash');
var passport = require('passport');
var nodemailer = require('nodemailer');
var hbs = require('hbs');
var MongoStore = require('connect-mongo')(session);
var compression = require('compression');

var debug = require('debug')('cellar:server');
var http = require('http');

var routes = require('./routes/router');
var auth = require('./routes/auth');
var admin = require('./routes/admin');

require('./config/passport');

var app = express();
module.exports = app;

app.locals.transporter = nodemailer.createTransport({
  pool: true,
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_USE_TLS,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS
  }
});
app.locals.mailer = require('./mailer.js');
app.locals.name = 'Cellar';

var mongoose = require('mongoose');
mongoose.connect(env.MONGODB);

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function () {
  debug('Successfully connected to MongoDB.');
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
hbs.localsAsTemplateData(app);

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(expressValidator());
app.use(express.static(path.join(__dirname, 'public')));
app.use(compression());
app.use(session(
  {
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    maxAge: new Date(Date.now() + 3600000),
    store: new MongoStore(
      {
        mongooseConnection: mongoose.connection
      })
  }));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.use(function (req, res, next) {
  res.removeHeader('x-powered-by');
  res.locals.user = req.user;
  res.locals.url = req.protocol + '://' + req.get('host') + req.originalUrl;
  next();
});

app.use('/', auth);
app.use('/admin', admin);
app.use('/', routes);

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

hbs.registerHelper('ifnot', function (a, options) {
  if (!a) {
    return options.fn(this);
  }
  return options.inverse(this);
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

hbs.registerHelper('toJSON', function (object) {
  return JSON.stringify(object);
});

hbs.registerHelper('getYear', function () {
  var startYear = 2017;
  var today = new Date();
  var year = today.getFullYear();
  if (year === startYear) {
    return year;
  } else {
    return startYear + ' - ' + year;
  }
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
