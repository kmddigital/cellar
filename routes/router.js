var express = require('express');
var router = express.Router();

/* GET Index Page */
router.get('/', function (req, res) {
  res.render('index');
});

module.exports = router;
