var env = process.env;
var cellar = require('./cellar');
var transporter = cellar.locals.transporter;

exports.sendMail = function (mailOptions, callback) {
  mailOptions.from = '"' + cellar.locals.name + '" <' + env.SMTP_USER + '>';
  transporter.sendMail(mailOptions, function (err) {
    callback(err);
  });
};
