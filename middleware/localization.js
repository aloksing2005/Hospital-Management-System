const en = require('../locales/en.json');
const hi = require('../locales/hi.json');

module.exports = (req, res, next) => {
  const lang = req.session.lang || 'en';
  res.locals.t = lang === 'hi' ? hi : en;
  res.locals.currentLang = lang;
  next();
};
