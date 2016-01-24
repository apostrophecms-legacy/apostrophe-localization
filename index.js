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
  self._pages = options.pages;
  self.universal = options.universal || [];
  self.localized = [ 'title' ].concat(options.localized || []);
  self.locales = options.locales;
  self.defaultLocale = options.defaultLocale;
  self.neverTypes = options.neverTypes || [];
  self._apos.mixinModuleAssets(self, 'localization', __dirname, options);

  self._action = '/apos-localization';

  self._apos.addLocal('aposLocalePicker', function(args) {
    var currentLocale = self._apos._aposLocals.getLocale();
    var currentUrl = self._apos._aposLocals.getUrl();
    var locales = [];
    var availableLanguages = _.keys(self.locales);
    if( args && args.localized){
		availableLanguages = _.keys(args.localized);
	}

    _.each(self.locales, function(label, locale) {
      newUrl = '/' + locale + currentUrl;

      var localeObject = {
        key: locale,
        label: label,
        url: newUrl,
        translated: _.contains(availableLanguages, locale),
        active: (currentLocale === locale)
      };
      locales.push(localeObject);
    });
    return self.render('localePicker', { locales: locales, args: args });
  });

  self.setLocale = function(req, locale) {
    req.session.locale = locale;
    req.locale = locale;
  };

  self._apos.pushGlobalCallWhen('user', 'window.aposLocalization = new AposLocalization()');

  self.pushAsset('script', 'user', { when: 'user' });
  self.pushAsset('stylesheet', 'user', { when: 'user' });

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

    if (_.contains(self.neverTypes, page.type)) {
      return superBeforePutPage(req, page, callback);
    }

    ensureProperties(page, req);

    // We translate top-level properties specifically called out for translation,
    // plus all top-level areas not specifically denied translation. A recursive
    // walk of all areas is a bad idea here because it would make more sense
    // to just translate the entire top-level area. -Tom

    var before = JSON.stringify(page.localized[req.locale] || {});

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

    var after = JSON.stringify(page.localized[req.locale] || {});

    if (before !== after) {
      page.localizedAt[req.locale] = new Date();
      if (req.locale === self.defaultLocale) {
        page.localizedStale = _.without(_.keys(self.locales), self.defaultLocale);
      } else {
        // modifies in place
        _.pull(page.localizedStale, req.locale);
      }
    }

    return superBeforePutPage(req, page, callback);
  };

  var superBeforeLoadWidgets = self._apos.beforeLoadWidgets || function(req, results, callback) {
    return callback(null);
  };

  self._apos.beforeLoadWidgets = function(req, results, callback) {
    var pages = results.pages;

    if (!pages) {
      // This is a query we don't deal with, such as a distinct query
      return superBeforeLoadWidgets(req, results, callback);
    }

    _.each(pages, function(page) {

      if (_.contains(self.neverTypes, page.type)) {
        return;
      }

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

        // for bc with sites that didn't have this module until
        // this moment, if the default locale has no content,
        // populate it from the live property
        if (!_.has(page.localized[self.defaultLocale], key)) {
          page.localized[self.defaultLocale] = page[key];
        }

        if (!_.has(page.localized[req.locale], key)) {
          return;
        }
        // do a shallow clone so the slug property can differ
        page[key] = _.clone(page.localized[req.locale][key]);

      });

      // Other properties are localized only if they are on the list.

      _.each(self.localized, function(name) {
        name = localizeForPage(page, name);
        if (!name) {
          return;
        }

        // for bc with sites that didn't have this module until
        // this moment, if the default locale has no content,
        // populate it from the live property
        if (!_.has(page.localized[self.defaultLocale], name)) {
          page.localized[self.defaultLocale] = page[name];
        }

        if (!_.has(page.localized[req.locale], name)) {
          return;
        }
        page[name] = page.localized[req.locale][name];
      });

    });

    return superBeforeLoadWidgets(req, pages, callback);
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

  self._apos.addLocal('aposLocalizationMenu', function(args) {
    var result = self.render('menu', args);
    return result;
  });

  self._app.post(self._action + '/report', function(req, res) {
    var modal = true;
    if (req.body.page) {
      // just replacing the content with a new page
      modal = false;
    }
    var page = self._apos.sanitizeInteger(req.body.page);
    if (page < 1) {
      page = 1;
    }
    var perPage = (self.options.report && self.options.report.perPage) || 20;
    var skip = (page - 1) * perPage;
    var limit = perPage;
    var sort = {};
    var total;
    var count;
    var docs;
    // Most egregiously ancient first
    sort['localizedAt.' + self.defaultLocale] = 1;
    var query = {
      localized: { $exists: 1 },
      $or: [
        {
          localizedStale: {
            $in: [ req.locale ]
          }
        },
        {
          localizedSeen: {
            $nin: [ req.locale ]
          }
        },
        {
          localizedSeen: { $exists: 0 }
        }
      ]
    };
    if (self.neverTypes.length) {
      query.type = { $nin: self.neverTypes };
    }
    return async.series({
      get: function(callback) {
        return self._apos.get(req, query, {
          sort: sort,
          fields: {
            title: 1,
            slug: 1,
            type: 1,
            localizedAt: 1
          },
          skip: skip,
          // Don't do expensive things
          areas: false,
          // Don't care if it's published or not
          published: null,
          limit: limit
        }, function(err, results) {
          if (err) {
            return callback(err);
          }
          count = results.total;
          docs = results.pages;
          total = Math.ceil(count / perPage);
          if (total < 1) {
            total = 1;
          }
          return callback(null);
        });
      },
    }, function(err) {
      if (err) {
        console.error(err);
        res.statusCode = 500;
        return res.send('error');
        return res.send({ status: 'error' });
      }

      var typeLabels = {};
      _.each(self._pages.types, function(type) {
        if (type.instanceLabel) {
          typeLabels[type._instance] = type.instanceLabel;
        }
        if (type.label) {
          typeLabels[type.name] = type.label;
        }
      });

      return res.send(
        self.render(modal ? 'report.html' : 'reportPage.html',
          {
            docs: docs,
            locales: self.locales,
            locale: req.locale,
            typeLabels: typeLabels,
            defaultLocale: self.defaultLocale,
            pager: {
              page: page,
              total: total
            }
          },
          req
        )
      );
    });
  });

  // Invoke the callback. This must happen on next tick or later!
  return process.nextTick(function() {
    return callback(null);
  });

  function ensureProperties(page, req) {
    if (!_.has(page, 'localized')) {
      page.localized = {};
    }
    if (!_.has(page, 'localizedAt')) {
      page.localizedAt = {};
    }
    if (!_.has(page, 'localizedStale')) {
      page.localizedStale = [];
    }
    page.localizedSeen = _.union(page.localizedSeen || [], _.keys(self.locales));
    if (!_.has(page.localized, req.locale)) {
      page.localized[req.locale] = {};
    }
    if (!_.has(page.localized, self.defaultLocale)) {
      page.localized[self.defaultLocale] = {};
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
