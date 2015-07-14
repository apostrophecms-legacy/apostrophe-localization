module.exports = factory;
var deep = require('deep-get-set');
var _ = require('lodash');
var async = require('async');

function factory(options, callback) {
 return new Construct(options, callback);
}

function Construct(options, callback) {
  var self = this;
  self.options = options;
  self._apos = options.apos;
  self._app = options.app;

  self.universal = options.universal || [];
  self.localized = [ 'title' ].concat(options.localized || []);
  self.locales = options.locales;
  self.defaultLocale = options.defaultLocale;
  self._apos.mixinModuleAssets(self, 'i18n', __dirname, options);

  self._action = '/apos-i18n';

  self._apos.addLocal('aposLocalePicker', function() {
    var currentLocale = self._apos._aposLocals.getLocale();
    var currentUrl = self._apos._aposLocals.getUrl();
    var locales = [];

    _.each(self.locales, function(label, locale) {
      newUrl = '/' + locale + currentUrl;

      var localeObject = {
        label: label,
        url: newUrl,
        active: (currentLocale === locale)
      };
      locales.push(localeObject);
    });
    return self.render('localePicker', { locales: locales });
  });

  self.setLocale = function(req, locale) {
    req.session.locale = locale;
    req.locale = locale;
  };

  self.middleware = [

    // if a locale is set in the session, set req.locale based on that

    function(req, res, next) {
      if (req.session.locale) {
        req.locale = req.session.locale;
      } else {
        req.locale = self.defaultLocale;
      }
      return next();
    },

    // recognize /en/about; set req.locale accordingly, then remove the prefix
    // so that routing can continue normally

    function(req, res, next) {
      if (req.method !== 'GET') {
        return next();
      }
      var matches = req.url.match(/^\/(\w+)(\/.*|\?.*|)$/);
      if (!matches) {
        return next();
      }
      if (!_.has(self.locales, matches[1])) {
        return next();
      }
      req.locale = matches[1];
      req.session.locale = req.locale;
      req.url = matches[2];
      if (!req.url.length) {
        req.url = '/';
      }
      return next();
    }

  ];

  var superBeforePutPage = self._apos.beforePutPage;

  self._apos.beforePutPage = function(req, page, callback) {

    ensureProperties(page, req);

    // We translate top-level properties specifically called out for translation,
    // plus all top-level areas not specifically denied translation. A recursive
    // walk of all areas is a bad idea here because it would make more sense
    // to just translate the entire top-level area. -Tom

    _.each(page, function(value, key) {
      if (!isArea(value)) {
        return;
      }
      if (isUniversal(page, key)) {
        return;
      }
      page.localized[req.locale][key] = value;
      // Revert .body to the default culture's body, unless
      // that doesn't exist yet, in which case we let it spawn from
      // the current culture
      if (_.has(page.localized[self.defaultLocale], key)) {
        page[key] = page.localized[self.defaultLocale][key];
      } else {
        page.localized[self.defaultLocale][key] = page[key];
      }
    });

    // Other properties are localized only if they are on the list.

    _.each(self.localized, function(name) {
      name = localizeForPage(page, name);
      if (!name) {
        return;
      }
      page.localized[req.locale][name] = page[name];
      // Revert .title to the default culture's title, unless
      // that doesn't exist yet, in which case we let it spawn from
      // the current culture
      if (_.has(page.localized[self.defaultLocale], name)) {
        page[name] = page.localized[self.defaultLocale][name];
      } else {
        page.localized[self.defaultLocale][name] = page[name];
      }
    });

    return superBeforePutPage(req, page, callback);
  };

  var superAfterGet = self._apos.afterGet || function(req, results, callback) {
    return callback(null);
  };

  self._apos.afterGet = function(req, results, callback) {
    var pages = results.pages;

    if (!pages) {
      // This is a query we don't deal with, such as a distinct query
      return superAfterGet(req, pages, callback);
    }

    _.each(pages, function(page) {
      ensureProperties(page, req);

      // We translate top-level properties specifically called out for translation,
      // plus all top-level areas not specifically denied translation. A recursive
      // walk of all areas is a bad idea here because it would make more sense
      // to just translate the entire top-level area. -Tom

      _.each(page, function(value, key) {
        if (!isArea(value)) {
          return;
        }
        if (isUniversal(page, key)) {
          return;
        }
        if (!_.has(page.localized[req.locale], key)) {
          return;
        }
        page[key] = page.localized[req.locale][key];
      });

      // Other properties are localized only if they are on the list.

      _.each(self.localized, function(name) {
        name = localizeForPage(page, name);
        if (!name) {
          return;
        }
        if (!_.has(page.localized[req.locale], name)) {
          return;
        }
        page[name] = page.localized[req.locale][name];
      });

    });

    return superAfterGet(req, pages, callback);
  };

  // Do not call loaders for all of the localized content. They will
  // get called for the current locale's content, which has been
  // swapped into body, etc. at this point
  var superCallLoadersForArea = self._apos.callLoadersForArea;
  self._apos.callLoadersForArea = function(req, area, callback) {
    if (area.slug.match(/\:localized/)) {
      return setImmediate(callback);
    }
    return superCallLoadersForArea(req, area, callback);
  };

  // Invoke the callback. This must happen on next tick or later!
  return process.nextTick(function() {
    return callback(null);
  });

  function ensureProperties(page, req) {
    if (!_.has(page, 'localized')) {
      page.localized = {};
    }
    if (!_.has(page.localized, req.locale)) {
      page.localized[req.locale] = {};
    }
    if (!_.has(page.localized, req.defaultLocale)) {
      page.localized[req.defaultLocale] = {};
    }
  }

  function isArea(value) {
    if ((!value) || (value.type !== 'area')) {
      return false;
    }
    return true;
  }

  function isUniversal(page, key) {
    if (_.contains(self.options.universal || [], key) || _.contains(self.options.universal || [], page.type + ':' + key)) {
      return;
    }
  }

  function localizeForPage(page, name) {
    var matches = name.match(/[\w+]:[\w+]/);
    if (matches) {
      if (page.type !== matches[1]) {
        return;
      }
      name = matches[2];
    }
    if (!_.has(page, name)) {
      return;
    }
    return name;
  }
};

// Export the constructor so others can subclass
factory.Construct = Construct;
