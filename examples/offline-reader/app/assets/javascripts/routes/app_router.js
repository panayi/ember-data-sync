OfflineReader.Router = Ember.Router.extend({
  location: 'hash',
  enableLogging: true,

  root: Ember.Route.extend({
    gotoBlank: Ember.Route.transitionTo('index.blank'),
    gotoFeed: Ember.Route.transitionTo('index.pages'),
    gotoPage: Ember.Route.transitionTo('index.page'),

    index: Ember.Route.extend({
      route: '/',

      connectOutlets: function(router) {
        router.get('applicationController').connectOutlet({ name: 'rsses', context: OfflineReader.Rss.find(), outletName: 'rsses' });
      },

      blank: Ember.Route.extend({
        route: '/'
      }),

      pages: Ember.Route.extend({
        route: '/rss/:rss_id',

        connectOutlets: function(router, context) {
          router.get('applicationController').connectOutlet({ name: 'rss', context: context, outletName: 'bogus' });
          router.get('applicationController').connectOutlet({ name: 'pages', context: OfflineReader.Page.find({rss: context}) });
        }
      }),

      page: Ember.Route.extend({
        route: '/page/:page_id',

        connectOutlets: function(router, context) {
          router.get('applicationController').connectOutlet({ name: 'page', context: OfflineReader.Page.find(context.id) });
        }
      })
    }),

    createNewRss: function(router) {
      var url = router.applicationController.get('newRssUrl');
      var rssRecord = router.store.createRecord(OfflineReader.Rss, { url: url });
      router.store.commit();

      router.send('gotoFeed', rssRecord);
    }
  })
});

