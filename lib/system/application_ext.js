var get = Ember.get, set = Ember.set;

// TODO: Should find a better way to initialize the store.
Ember.Application.reopen({
  ready: function() {
    var store = this.router.store;
    store._initialize();
    this._super();
  }
});

Ember.onLoad('Ember.Application', function(Application) {
  Ember.Application.registerInjection({
    name: "setupSynchronizedStore",
    after: ['store'],

    injection: function(app, stateManager, property) {
      if (!stateManager) { return; }
      if (property === 'Store') {
        var store = get(stateManager, 'store');

        if (!store) { return; }

        var revision = store.revision;

        var mappings = get(store, 'adapter.mappings');
        Ember.assert("Currently you need to provide mappings of JSON keys to modelTypes (e.g., persons: App.Person)." +
          "But your adapter's mappings property is null.", !!mappings);

        var serverAdapter = DS._ServerAdapter.create({
          mappings: mappings
        });

        var serverStore = DS._ServerStore.create({
          adapter: serverAdapter,
          revision: revision,
          clientStore: store
        });
        set(store, 'serverStore', serverStore);
      } 
    }
  });
});

