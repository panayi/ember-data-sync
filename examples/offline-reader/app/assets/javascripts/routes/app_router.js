OfflineReader.Router = Ember.Router.extend({
  location: 'hash',

  root: Ember.Route.extend({
    index: Ember.Route.extend({
      route: '/',

      connectOutlets: function(router) {
        router.get('applicationController').connectOutlet({ name: 'rsses', context: OfflineReader.Rss.find(), outletName: 'rsses' });
      }
    }),

    rss: Ember.Route.extend({
      route: '/view',

      index: Ember.Route.extend({
        route: '/rss/:rss_id',

        connectOutlet: function(router, context) {
          router.get('applicationController').connectOutlet({ name: 'pages', context: OfflineReader.Page.find({rss: context}) });
        }
      }),

      show: Ember.Route.extend({
        route: '/page/:page_id',

        connectOutlet: function(router, context) {
          router.get('applicationController').connectOutlet({ name: 'pages', context: OfflineReader.Page.find(context.id) });
        }
      })
    }),
  })
});

