(function() {
DS._ModifiedRecordsHelpers = Ember.Mixin.create({
  eachModifiedRecord: function(commitDetails, callback, context) {

    ['created', 'updated', 'deleted'].forEach(function(bucketType) {
      commitDetails[bucketType].forEach(function(record) {
        callback.call(context, bucketType, record);
      }, context);
    }, context);
  }
});
})();



(function() {
var get = Ember.get;

/**
  A serializer for providing the ability to serialize a record from the serverStore 
  into the clientStore and vice versa. It takes a record and extracts its
  attributes and associations, preserving the keys.
 */
DS._InternalSyncSerializer = DS.JSONSerializer.extend({
  serialize: function(record, options) {
    options = options || {};

    var serialized = this.createSerializedForm(), id;

    if (options.includeId) {
      if (id = get(record, 'id')) {
        this.addId(serialized, id);
      }
    }

    this.addAttributes(serialized, record);
    this.addRelationships(serialized, record, options.includeHasMany);

    return serialized;
  },

  addId: function(serialized, id) {
    serialized.id = id;
  },

  addAttributes: function(serialized, record) {
    record.eachAttribute(function(name, attribute) {
      this.addAttribute(serialized, record, name, attribute);
    }, this);
  },

  addAttribute: function(serialized, record, name, attribute) {
    var value = get(record, name);
    serialized[name] = this.serializeValue(value, attribute.type);
  },

  addRelationships: function(serialized, record, includeHasMany) {
    record.eachAssociation(function(name, relationship) {
      if (relationship.kind === 'hasMany' && includeHasMany) {
        this.addRelationship(serialized, record, name, relationship.kind);
      }
    }, this);
  },

  addRelationship: function(serialized, record, name, kind) {
    serialized[name] = record._data[kind][name];
  }
});
})();



(function() {
var get = Ember.get, set = Ember.set;

DS._ServerStore = DS.Store.extend(DS._ModifiedRerordsHelpers, {
  init: function() {
    this._super();
    set(this, 'internalSerializer', DS._InternalSyncSerializer.create());
  },

  copyAndCommit: function(commitDetails) {
    var transaction = this.defaultTransaction;
    eachModifiedRecord(commitDetails, function(bucketType, serializedRecord) {
      var record = this.createRecord(serializedRecord.type, serializedRecord.data);
      transaction.removeFromBucket('created', record);
      transaction.addToBucket(bucketType, record);
    }, this);

    this.commit();
  },

  downSync: function() {
    this.adapter.downSync(this);
  },

  downSyncRecord: function(type, hash, timestamps, maxModified) {
    get(this, 'clientStore').downSyncRecord(type, hash, timestamps, maxModified, this.simulateLoad);
  },

  simulateLoad: function(type, id, data, modificationKind) {
    var store = this;
    var clientId = this.pushData('loading', id, type);
    var record = this.materializeRecord(type, clientId, id);

    record.setupDidLoad(function() {
      store.alsoCommitToClient(type, id, this, modificationKind);
    });

    this.load(type, id, data);
  },

  alsoCommitToClient: function(type, id, record, modificationKind) {
    var internalSerializedData = this.internalSerializer.serialize(record, { includeId: true });
    get(this, 'clientStore').copyAndCommit(type, id, internalSerializedData, modificationKind);
  },

  didCompleteDownSync: function() {
    var clientStore = get(this, 'clientStore');
    clientStore.didCompleteDownSync();
  },

  maxModified: function() {
    return get(this, 'clientStore.maxModified');
  }.property('clientStore.maxModified')
});

})();



(function() {
/**
  The default Transaction class. This class extends the commit method for:
  (a) remembering any modified records (persisted on the client storage)
  (b) passing modified records to the server store to commit (if the user is online)
 */

var get = Ember.get;

DS.ClientTransaction = DS.Transaction.extend({
  // In addition to committing to client storage: 
  // (a) remember modified records and (b) trigger an up-sync.
  commit: function() {
    var store = get(this, 'store');

    var commitDetails = this.copyCommitDetails();
    var pendingUpSyncRecords = store.rememberModifiedRecords(commitDetails);

    store.alsoCommitToServer(pendingUpSyncRecords);

    this._super();
  },

  copyCommitDetails: function() {
    return {
      created: this.bucketForType('created').copy(),
      updated: this.bucketForType('updated').copy(),
      deleted: this.bucketForType('deleted').copy()
    };
  }
});
})();



(function() {
/**
  The main store that is exposed to the app. DS.SyncStore is responsible for:
  (a) reading and writing sync meta data on the client storage
  (b) committing records to the client storage passed from the server store
 */

var get = Ember.get, set = Ember.set;

// Options used for communicating with the server, that are passed to the server store.
// Includes: the JSON keys of server records timestamps, 
// the key of server's records primary id,
// the server url path for down-syncing. 
var defaultServerOptions = {
  keyForId: 'id',
  keyForCreated: 'created_at',
  keyForUpdated: 'updated_at',
  keyForDeleted: 'deleted_at',
  keyForMaxModified: 'max_modified',
  downSyncPath: 'sync'
};

var newModifiedRecordsBuckets = function() {
  return {
    created:  Ember.OrderedSet.create(),
    updated:  Ember.OrderedSet.create(),
    deleted:  Ember.OrderedSet.create()
  };
};

DS.ClientStore = DS.Store.extend(DS._ModifiedRecordsHelpers, {
  pendingUpSyncRecords: [],

  /*                */
  /*  Base methods  */

  transaction: function() {
    return DS.ClientTransaction.create({ store: this });
  },

  normalTransaction: function() {
    return DS.Transaction.create({ store: this });
  },

  normalDeleteRecord: function(record) {
    var transaction = this.normalTransaction();
    transaction.add(record);
    this.deleteRecord(record);
    transaction.commit();
  },

  findAndDeleteRecord: function(type, id) {
    var record = this.find(type, id);
    record.setupDidLoad(function() {
      this.normalDeleteRecord(this);
    });
  },

  /*                           */
  /*  Up-sync related methods  */

  alsoCommitToServer: function(pendingUpSyncRecords) {
    var modifiedRecords = newModifiedRecordsBuckets();
    var serverStore = get(this, 'serverStore');
    var actualRecord, data, self = this, unLoadedRecords = 0;

    pendingUpSyncRecords.forEach(function(record) {
      actualRecord = this.find(get(record, 'recordType'), get(record, 'recordId'));

      unLoadedRecords++;

      actualRecord.setupDidLoad(function() {
        data = self.internalSerializer.serialize(this, { includeId: true });
        modifiedRecords[get(record, 'pendingReason')].add({ data: data, type: get(record, 'recordType') });

        unLoadedRecords--;

        if (unLoadedRecords === 0) {
          serverStore.copyAndCommit(modifiedRecords);
        }
      });
    }, this);
  },

  rememberModifiedRecords: function(commitDetails) {
    var pendingUpSyncRecords = [];
    var transaction = this.normalTransaction();

    eachModifiedRecord(commitDetails, function(bucketType, record) {
      pendingUpSyncRecords.pushObject(this.createPendingUpSyncRecord(transaction, bucketType, record));
    }, this);

    get(this, 'pendingUpSyncRecords').pushObjects(pendingUpSyncRecords);

    transaction.commit();
    return pendingUpSyncRecords;
  },

  createPendingUpSyncRecord: function(transaction, kind, record) {
    return transaction.createRecord(DS._PendingUpSyncRecord, {
      recordId: get(record, 'id'),
      recordType: record.constructor,
      pendingReason: kind
    });
  },

  /*                             */
  /*  Down-sync related methods  */

  copyAndCommit: function(type, id, data, modificationKind) {
    var transaction = this.normalTransaction();

    if (modificationKind === 'created') {
      transaction.createRecord(type, data);
      transaction.commit();
    } else {
      var record = this.find(type, id);
      record.setupDidLoad(function() {
        transaction.add(this);
        this.setProperties(data);
        transaction.commit();
      });
    }
  },

  downSync: function() {
    this.serverStore.downSync(this);
  },

  downSyncRecord: function(type, hash, timestamps, maxModified, callback) {
    var serverStore = get(this, 'serverStore');
    var id = hash.id;

    var modificationKind = this.computeModificationKind(timestamps, maxModified);
    var modified = timestamps.updatedAt;

    // First see if there matching pending up-synced records
    var isLocalPendingUpSyncRecord = this.deleteMatchingPendingUpSyncRecords(id, modificationKind);

    // Only create or delete when there is no local pending up-sync record. 
    // Updates can happen in any case (they are harmless anyway)
    if (!isLocalPendingUpSyncRecord && modificationKind === 'deleted') {
      this.findAndDeleteRecord(type, id);
      modified = timestamps.deletedAt;

    } else if ((!isLocalPendingUpSyncRecord && modificationKind === 'created') || (modificationKind === 'updated')) {
      callback.call(serverStore, type, id, hash, modificationKind);
    }

    this.updateMaxModified(modified);
  },

  computeModificationKind: function(timestamps, maxModified) {
    if (!!timestamps.deletedAt) { return 'deleted'; } 
    if (new Date(timestamps.createdAt) > new Date(maxModified)) { return 'created'; } 
    return 'updated';
  },

  // TODO: is it possible to have more than one matching pending up-sync records?
  deleteMatchingPendingUpSyncRecords: function(recordId, pendingReason) {
    var pendingUpSyncRecords = get(this, 'pendingUpSyncRecords')

    var matching = pendingUpSyncRecords.filter(function(record) {
      return get(record, 'recordId') === recordId && get(record, 'pendingReason') === pendingReason;
    }, this);
    
    matching.forEach(function(record) {
      this.normalDeleteRecord(record);
    }, this);

    pendingUpSyncRecords.removeObjects(matching);

    return matching.length > 0;
  },

  updateMaxModified: function(modified) {
    var maxModified = get(this, 'maxModified');
    var maxModifiedRecord = get(this, 'maxModifiedRecord');
    if (new Date(modified) > new Date(maxModified)) {
      this._maxModifiedTransaction.add(maxModifiedRecord);
      set(maxModifiedRecord, 'timestamp', modified);
    }
  },

  maxModified: function() {
    return get(this, 'maxModifiedRecord.timestamp');
  }.property('maxModifiedRecord.timestamp'),

  didCompleteDownSync: function() {
    this._maxModifiedTransaction.commit();
  },

  /*                          */
  /*  Initialization methods  */

  init: function() {
    this._super();
    set(this, 'internalSerializer', DS._InternalSyncSerializer.create());
  },

  _initialize: function() {
    var serverOptions = {};
    for (var key in defaultServerOptions) {
      serverOptions[key] = this[key] || defaultServerOptions[key];
    }
    get(this, 'serverStore.adapter')._setServerOptions(serverOptions);

    set(this, '_pendingUpSyncRecords', this.findQuery(DS._PendingUpSyncRecord, {}));
    set(this, '_maxModifiedRecords', this.findQuery(DS._MaxModified, {}));
  },

  _onLoadMaxModifiedRecords: function() {
    var maxModifiedRecords = get(this, '_maxModifiedRecords');
    if (!get(maxModifiedRecords, 'isLoaded')) { return; }

    this._maxModifiedTransaction = this.normalTransaction();
    
    if (get(maxModifiedRecords, 'content.length') > 0) {
      var maxModifiedRecord = maxModifiedRecords.toArray()[0];
      this._maxModifiedTransaction.add(maxModifiedRecord);
    } else {
      var maxModifiedRecord = this._maxModifiedTransaction.createRecord(DS._MaxModified);
      this._maxModifiedTransaction.commit();
    }

    set(this, 'maxModifiedRecord', maxModifiedRecord);
  
  }.observes('_maxModifiedRecords.isLoaded'),

  _onLoadPendingUpSyncRecords: function() {
    var pendingUpSyncRecords = get(this, '_pendingUpSyncRecords');

    if (!(get(pendingUpSyncRecords, 'isLoaded') && get(this, 'maxModifiedRecord'))) { return; }
    
    if (pendingUpSyncRecords && pendingUpSyncRecords.length > 0) {
      // Send pending up-sync records, that were modified in the previous app session
      this.alsoCommitToServer(pendingUpSyncRecords);
    } else {
      // Force a down sync on application load
      this.downSync();
    }

    get(this, 'pendingUpSyncRecords').pushObjects(pendingUpSyncRecords);

  }.observes('_pendingUpSyncRecords.isLoaded', 'maxModifiedRecord'),
});


})();



(function() {
var get = Ember.get;

DS.Model.reopen({
  setupDidLoad: function(didLoadStrict) {
    this.didLoadStrict = didLoadStrict;
    this.addObserver('isLoaded', this, 'runOnceOnLoadAndBecomeClean');
    this.addObserver('isDirty', this, 'runOnceOnLoadAndBecomeClean');
    this.runOnceOnLoadAndBecomeClean();
  },

  runOnceOnLoadAndBecomeClean: function() {
    if (get(this, 'isLoaded') && !get(this, 'isDirty')) {
      this.didLoadStrict();
      this.removeObserver('isLoaded', this, 'runOnceOnLoadAndBecomeClean');
      this.removeObserver('isDirty', this, 'runOnceOnLoadAndBecomeClean');
      this.didLoadStrict = Ember.K;
    }
  },

  didLoadStrict: Ember.K
});
})();



(function() {
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


})();



(function() {
DS._ServerSerializer = DS.RESTSerializer.extend({
  // In some cases, it is difficult to change the behavior of 
  // an auto-incrementing id on the server (such is the case in Rails).
  // The app is able to specify an alternative key for the id (such as `uuid`),
  // by setting `keyForId` on the store.
  addId: function(data, key, id) {
    var keyForId = this.keyForId || 'id';
    data[keyForId] = id;
  }
});
})();



(function() {
var get = Ember.get, set = Ember.set;

/**
  A stripped-down version of the RESTAdapter. 
  TODO: Since only 2-3 methods are used from RESTAdapter,
  consider extending from DS.Adapter. 
 */
DS._ServerAdapter = DS.RESTAdapter.extend({
  serializer: DS._ServerSerializer,

  init: function() {
    this._super();

    ['didCreateRecord', 'didCreateRecords', 'didUpdateRecord', 
     'didUpdateRecords', 'didDeleteRecord', 'didDeleteRecords'].forEach(function(name) {
      this[name] = function(store, type, records, json) {
        this.didUpSync(store);
      };
    }, this);
  },

  _setServerOptions: function(options) {
    this.setProperties(options);
    get(this, 'serializer').setProperties(options);
  },

  // On up-sync completed, send a down-sync immediately.
  // This is crucial to ensure that the max-modified timestamp is updated correctly.
  // The response will also include records from the previous up-sync, therefore aknowledging up-sync success. 
  didUpSync: function(store) {
    this.downSync(store);
  },

  // Only send the maxModified timestamp
  // Server should respond with records modified after maxModified.
  downSync: function(store) {
    var url = this.downSyncPath;
    
    var hash = {}; hash.data = {};
    hash.data[this.keyForMaxModified] = get(store, 'maxModified');
    hash.success = function(json) {
      this.didDownSync(store, json);
    };

    this.ajax(url, "POST", hash);
  },

  // Delegate down-syncing to the client store. The client store
  // will handle creating/updating/deleting records in the client storage.
  didDownSync: function(store, json) {
    var type, hashes, timestamps;
    var maxModified = get(store, 'maxModified');

    for (var key in json) {
      type = this.keyToType(key);
      hashes = Ember.isArray(json[key]) ? json[key] : [json[key]];

      hashes.forEach(function(hash) {
        var timestamps = this.getTimestamps(hash);
        store.downSyncRecord(type, hash, timestamps, maxModified);
      }, this);
    }

    store.didCompleteDownSync();
  },

  // Because the server responds with multiple model objects in the down-sync
  // this method is used to map JSON keys to modelTypes. The mappings should be provided by the app.
  // TODO: NEED to find a way to avoid this.
  keyToType: function(key) {
    return Ember.get(this.mappings[key] || this.mappings[this.pluralize(key)]);
  },

  getTimestamps: function(hash) {
    return {
      createdAt: hash[this.keyForCreated],
      updatedAt: hash[this.keyForUpdated],
      deletedAt: hash[this.keyForDeleted]
    };
  }
});
})();



(function() {

})();



(function() {
/**
  Store (on the client) the maximum modified (created/updated/deleted/) 
  timestamp among all client stored records.
 */
DS._MaxModified = DS.Model.extend({
  timestamp: DS.attr('string', { defaultValue: (new Date(0)).toString() }),
});
})();



(function() {
/**
  Store information about records that were modified 
  on the client (and not committed to server).
 */
DS._PendingUpSyncRecord = DS.Model.extend({
  recordId: DS.attr('string'),
  recordType: DS.attr('string'),
  pendingReason: DS.attr('string')
});
})();



(function() {

})();



(function() {

})();

