# apostrophe-localization

Allows internationalization, translation and localization of content on an [Apostrophe site](http://apostrophenow.org).

## Installation

First make sure you have an [Apostrophe project](http://apostrophenow.org)!

Then:

```
npm install --save apostrophe-localization
```

## Configuration

In `app.js`, add the module to your configuration. Specify the default locale (generally the native language of the primary content creators) and an array of additional locales to be supported:

```
... other modules ...
'apostrophe-localization': {
  defaultLocale: 'en',
  locales: { 'en': 'English', 'es': 'Español'}
}
```

The keys in the `locales` object should be standard international language and/or culture codes. The values should be labels, written in the language in question, suitable for display by a locale picker. The default locale should be included, typically as the first choice.

Optionally, add the locale picker to `outerLayout.html` wherever you see fit:

```
{{ aposLocalePicker() }}
```

The locale picker markup is deliberately easy to style, but you may also ignore it in favor of writing your own, as long as you generate the same links.

That's it!

## Internationalizing content

To translate content, just log in as you normally would and use the locale picker. At first you will continue to see content for the default locale. However, any edits to content areas and singletons that you make while you are switched to an alternate locale will be saved as a separate version for that locale only.

## Cross-cultural areas and singletons

If you wish, you can specify that certain area and singleton names should not be translatable. Any edits made to these are shared by all locales:

```javascript
... other modules ...
'apostrophe-localization': {
  ...
  universal: [ 'banner', 'thumbnail' ]
}
```

If you need to, you can lock these down to a specific page or snippet type:

```javascript
... other modules ...
'apostrophe-localization': {
  ...
  universal: [ 'home:banner', 'event:thumbnail' ]
}
```

## Cross-cultural properties beyond areas and singletons

By default, only areas, singletons, and the `title` property of each document are internationalized.

Sometimes it is appropriate to internationalize other schema fields too, particularly fields of type `string`, but it's not safe for us to assume that.

So, spell out the additional document properties you want to internationalize:

```javascript
... other modules ...
'apostrophe-localization': {
  ...
  localized: [ 'summary', 'teaser' ]
}
```

Again, you can lock these down to specific document type names:

```javascript
... other modules ...
'apostrophe-localization': {
  ...
  localized: [ 'event:summary', 'blogPost:teaser' ]
}
```

## Cross-cultural page and snippet types

You can also specify that internationalization should never be performed at all for a particular page type or snippet type:

```javascript
... other modules ...
'apostrophe-localization': {
  ...
  neverTypes: [ 'school', 'teaser' ]
}
```

Any document with its `type` property set to `school` or `teaser` will not be internationalized.

## Localization report

Your users can view a report of documents that need to be localized.

This report includes both documents that have never been localized and documents that have been updated for the default locale more recently than in the current locale.

For instance, if "English" is the default locale and you switch to "Spanish" and then open the localization report, you'll see a list of pages that have never been translated to Spanish or have a newer version in English.

Once you update those pages in Spanish, they no longer appear in the report until the next time an update is needed.

The documents that have gone the longest without attention appear first in the report.

To add the report, just add this code to `outerLayout.html` along with the other menus:

```
{{ aposLocalizationMenu(permissions) }}
```

## Under the hood: what it really looks like in the database

All localized properties are replicated inside a `localized` object (please pardon my bad Spanish):

```javascript
{
  title: 'About Us',
  localized: {
    en: {
      title: 'About Us',
    },
    es: {
      title: 'Sobre Nosotros'
    }
  }
}
```

However, Apostrophe automatically swaps the locale you really wanted to and from `title` and `body` when you fetch or store content. So **code that relies on `title` and `body` still works normally**.

**In the database, `title` and `body` are a copy of the default locale's content.** This provides reasonable fallback behavior for code that does not use `apos.get` and `apos.putPage` in a typical manner. It also allows a site to work immediately when localization is added later.

This simple approach to storing internationalized content allows the module to be implemented as straightforward enhancements to `apos.get` and `apos.putPage`.

## Accessing the default locale's content while viewing another locale

If you need access to the content for the default locale, you can access it like so:

```
page.localized.en.title
```

**However, for performance reasons, widget loaders are NOT called for content in other locales.** Otherwise the performance of the site would drop quickly as locales are added.

## Accessing the current locale string in templates

If you wish, you can access the current locale string, such as `es` or `en`, in a Nunjucks template by invoking `getLocale()`.

```
{% if getLocale() == 'es' %}
  {# Something special for Spanish #}
{% endif %}
```

## Limitations

See the github issues for limitations of this module.

## Changelog

0.5.9: added `apostrophe:populate-default-locale` task to be run just once when this module is added to an existing site; without this you'll see strange behavior on an existing site that wasn't always storing its default locale in a localized way. Touched up code formatting.

0.5.8: the locale choice objects provided to `aposLocalePicker` now have a `locale` property with the actual locale, so you can write custom logic around that. Thanks to Fotis Paraskevopoulos.

0.5.7: `aposLocalePicker` now accepts an optional argument, which is passed on to the template as `args`. You can take advantage of this feature in your override of the `localePicker.html` template to distinguish different styles.

0.5.6: support for the new localization report. Pages translated before this report was invented will all show as needing localization until they are edited for the first time for each locale.

0.5.5: documentation covers how to fetch the current locale name.

0.5.4: the `neverTypes` option completely excludes certain page types and/or snippet types from being localized.

0.5.3: use the new `apos.beforeLoadWidgets` method rather than `apos.afterGet` to avoid chicken and egg problems. Make a shallow clone of each area so that its slug property can be set distinctly.

0.5.2: don't mess up non-page queries.

0.5.1: populate the default locale in `page.localized` properly.

0.5.0: initial release.
