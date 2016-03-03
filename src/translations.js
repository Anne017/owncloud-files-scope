var Gettext = require('node-gettext');
var gt = new Gettext();

module.exports = {
    _: gt.gettext.bind(gt),
    gt: gt,
}
