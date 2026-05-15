const fs = require('fs');
const path = require('path');

const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en.json'), 'utf8'));
const hi = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/hi.json'), 'utf8'));

const translations = { en, hi };

const i18n = (req, res, next) => {
  // Check session for lang, default to en
  if (!req.session.lang) {
    req.session.lang = 'en';
  }

  const lang = req.session.lang;
  const currentTranslations = translations[lang] || translations['en'];

  // Expose translation function to EJS
  res.locals.t = (key) => {
    return currentTranslations[key] || key;
  };
  
  res.locals.currentLang = lang;
  next();
};

module.exports = i18n;
