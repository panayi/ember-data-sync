var get = Ember.get, set = Ember.set;

DS.Store.reopen({
  init: function() {
    set(this, 'defaultServerTransaction', this.serverTransaction());
    set(this, 'defaultClientTransaction', this.clientTransaction());

    this.initializeAdapter();

    this._super();
  },

  initializeAdapter: function() {
    get(this, '_adapter').initialize(this);
  },

  // Per-adapter methods and properties

  serverTransaction: function() {
    return DS.ServerTransaction.create({ store: this });
  },

  clientTransaction: function() {
    return DS.ClientTransaction.create({ store: this });
  },

  _serverAdapter: function() {
    var adapter = get(this, '_adapter');
    if (adapter) { return get(adapter, 'serverAdapter')};
  }.property('_adapter'),

  _clientAdapter: function() {
    var adapter = get(this, '_adapter');
    if (adapter) { return get(adapter, 'clientAdapter')};
  }.property('_adapter'),

  commitServer: function() {
    get(this, 'defaultServerTransaction').commit();
  },

  commitClient: function() {
    get(this, 'defaultClientTransaction').commit();
  },

  // Per-adapter write methods

  _createRecord: function(type, properties, target) {
    this.creaRecord(type, properties, this._transactionForTarget(target));
  },

  _transactionForTarget: function(target) {
    if (target instanceof DS.Transaction) {
      return target;
    }

    if (target === 'server') {
      return get(this, 'defaultServerTransaction');
    } 
    if (target === 'client') {
      return get(this, 'defaultClientTransaction');
    }
    return null;
  },

  sync: function() {
    this.adapter.sync(this);
  },

  getSyncData: function() {
    return this._syncData();
  }
});

