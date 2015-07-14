# apostrophe-localization

Allows internationalization, translation and localization of content on an [Apostrophe site](http://apostrophenow.org).

## Installation

First make sure you have an [Apostrophe project](http://apostrophenow.org)!

Then:

```
npm install --save apostrophe-i18n
```

## Configuration

In `app.js`, add the module to your configuration. Specify the default locale (generally the native language of the primary content creators) and an array of additional locales to be supported:

```
... other modules ...
'apostrophe-localization': {
  defaultLocale: 'en',
  locales: { 'en': 'English', 'es': 'Español'};
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
'apostrophe-i18n': {
  ...
  universal: [ 'banner', 'thumbnail' ]
}
```

If you need to, you can lock these down to a specific page or snippet type:

```javascript
... other modules ...
'apostrophe-i18n': {
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
'apostrophe-i18n': {
  ...
  localized: [ 'summary', 'teaser' ]
}
```

Again, you can lock these down to specific document type names:

```javascript
... other modules ...
'apostrophe-i18n': {
  ...
  localized: [ 'event:summary', 'blogPost:teaser' ]
}
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

## Limitations

See the github issues for limitations of this module.
