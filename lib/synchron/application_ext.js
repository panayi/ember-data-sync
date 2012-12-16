require('synchron/config');
require('synchron/models');

var get = Ember.get, set = Ember.set;

Ember.onLoad('Ember.Application', function(Application) {
  app.deferReadiness();

  var syncData = [
    { type: DS[UPSYNC_TYPE], data: app.store.findAll(DS[UPSYNC_TYPE]) }, 
    { type: DS[LASTDOWNSYNC_TYPE], data: app.store.findAll(DS[LASTDOWNSYNC_TYPE]) }
  ];

  var areAllLoaded = function() {
    if (syncData.everyProperty('data.isUpdating', false)) {
      set(app, 'store._syncData', syncData);
      app.advanceReadiness();

      syncData.removeObserver('@each.data.isUpdating', areAllLoaded);
    }
  };

  syncData.addObserver('@each.data.isUpdating', areAllLoaded);
  this.areAllLoaded();
});

