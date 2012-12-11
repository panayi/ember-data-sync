(function() {
var set = Ember.set;

// This code initializes the IndexedDB database and defers Ember
// readiness until it gets a reference to an IDBDatabase.
Ember.onLoad('application', function(app) {
  app.deferReadiness();

  var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;

  // We are not setting a default indexedDB database name, 
  // since it may conflict with other apps running on the same host.
  // Such could be the case when the app runs from the local filesystem.
  // TODO: it should check for conflicts with other apps on the same host, checking for extistence of db, ...
  var dbName = app.databaseName;
  Ember.assert('The indexedDB database name (databaseName) is not set in your Application object root', dbName);

  var createSchema = function(db) {
    var dbStore = db.createObjectStore(dbName, { keyPath: 'id' });
    dbStore.createIndex("_type", "_type", { unique: false })
  };

  var oldUpgradeNeededCheck = function(db, callback) {
    if (parseInt(db.version, 10) !== 1) {
      var setVersion = db.setVersion('1');
      setVersion.addEventListener('success', function() {
        createSchema(db);

        // Don't indicate readiness if still inside of the
        // "setVersion transaction". This craziness is
        // removed from the upgradeneeded version of the API.
        //
        // This returns the thread of execution to the
        // browser, thus ending the transaction.
        setTimeout(function() {
          callback(null, db);
        }, 1);
      });
    } else {
      callback(null, db);
    }
  };

  var openDB = function(name, callback) {
    var request = indexedDB.open(name, 1);

    // In the newer version of the API, if the version of the
    // schema passed to `open()` is newer than the current
    // version of the schema, this event is triggered before
    // the browser triggers the `success` event..
    request.addEventListener('upgradeneeded', function(event) {
      createSchema(request.result);
    });

    request.addEventListener('error', function(event) {
      // Node-style "error-first" callbacks.
      callback(event);
    });

    request.addEventListener('success', function(event) {
      var db = request.result;

      // Chrome (hopefully "Old Chrome" soon)
      if ('setVersion' in db) {
        oldUpgradeNeededCheck(db, callback);
      } else {
        // In the sane version of the spec, the success event
        // is only triggered once the schema is up-to-date
        // for the current version.
        callback(null, db);
      }
    });
  };

  openDB(dbName, function(error, db) {
    if (error) {
      // TODO: There is some kind of API that seems to require conversion from
      // a numeric error code to a human code.
      throw new Error("The ember-records database could not be opened for some reason.");
    }

    set(app, 'router.store.adapter.db', db);
    set(app, 'router.store.adapter.dbName', dbName);

    app.advanceReadiness();
  });
});
})();



(function() {
var get = Ember.get, set = Ember.set;

DS.IndexedDBSerializer = DS.JSONSerializer.create({
  addBelongsTo: function(hash, record, key, relationship) {
    hash[relationship.key] = get(get(record, key), 'id');
  },

  addHasMany: function(hash, record, key, relationship) {
    var ids = get(record, key).map(function(child) {
      return get(child, 'id');
    });

    hash[relationship.key] = ids;
  },

  addId: function(hash, type, id) {
    hash.id = [type.toString(), id];
  },

  extractId: function(type, hash) {
    // newly created records should not try to materialize
    if (hash && hash.id) { return hash.id[1]; }
  },

  toJSON: function(record, options) {
    options = options || {};

    var hash = {}, id;

    if (options.includeId) {
      if (id = get(record, 'id')) {
        this.addId(hash, record.constructor, id);
      }
    }

    this.addAttributes(hash, record);

    this.addRelationships(hash, record);

    return hash;
  }
});
})();



(function() {
var get = Ember.get, set = Ember.set;


DS.IndexedDBAdapter = DS.Adapter.extend({
  serializer: DS.IndexedDBSerializer,

  /**
    Hook used by the store to generate client-side IDs. This simplifies
    the timing of committed related records, so it's preferable.

    For this adapter, we use uuid.js by Rober Kieffer, which generates
    UUIDs using the best-available random number generator.

    @returns {String} a UUID
  */
  generateIdForRecord: function() {
    return uuid();
  },

  /**
    Takes a (record) or (a modelType and an id)
    and build the serialized id [type, id] to be stored in the db.
  **/
  dbId: function(obj, id) {
    if (obj instanceof DS.Model) {
      return [obj.constructor.toString(), get(obj, 'id')]
    } else {
      return [obj.toString(), id];
    }
  },

  toJSON: function(record, options) {
    return get(this, 'serializer').toJSON(record, options);
  },

  /**
    The main entry point called by Ember Data.

    It receives a store to notify when records have
    successfully saved, and a hash of information about
    what to commit.
  */
  save: function(store, commitDetails) {
    var relationships = commitDetails.relationships;

    relationships.forEach(function(relationship) {
      // HACK If a part of the relationship is
      // unmaterialized, also check to see whether
      // it's in any of the commitDetails.
      //
      // The store in Ember Data should really
      // prevent this from happening by correctly
      // hooking up newly materialized records if
      // they are part of a pending relationship.

      var child = relationship.getChild(),
          oldParent = relationship.getOldParent(),
          newParent = relationship.getNewParent();

      if (child === undefined || !this.any(child, commitDetails)) {
        this.updateChildRelationship(store, relationship);
      }

      if (oldParent === undefined || !this.any(oldParent, commitDetails)) {
        this.updateOldParentRelationship(store, relationship);
      }

      if (newParent === undefined || !this.any(newParent, commitDetails)) {
        this.updateNewParentRelationship(store, relationship);
      }
    }, this);

    return this._super.apply(this, arguments);
  },

  /**
    Main hook for saving a newly created record.

    @param {DS.Store} store
    @param {Class} type
    @param {DS.Model} record
  */
  createRecord: function(store, type, record) {
    var hash = this.toJSON(record, { includeId: true });
    var self = this;

    // Store the type in the value so that we can index it on read
    hash._type = type.toString();
    
    this.attemptDbTransaction(store, record, function(dbStore) {
      self.didSaveRecord(store, record, hash);
      return dbStore.add(hash);
    });
  },

  /**
    Main hook for updating an existing record.

    @param {DS.Store} store
    @param {Class} type
    @param {DS.Model} record
  */
  updateRecord: function(store, type, record) {
    var hash = this.toJSON(record, { includeId: true });
    var self = this;

    // Store the type in the value so that we can index it on read
    hash._type = type.toString();

    this.attemptDbTransaction(store, record, function(dbStore) {
      self.didSaveRecord(store, record, hash);
      return dbStore.put(hash);
    });
  },

  /**
    Main hook for deleting an existing record. Note that
    deletions can also trigger changes in relationships with
    other records.

    If those records are unloaded, those changes happen
    through the update*Relationship family of methods.

    @param {DS.Store} store
    @param {Class} type
    @param {DS.Model} record
  */
  deleteRecord: function(store, type, record) {
    var self = this;
    this.attemptDbTransaction(store, record, function(dbStore) {
      self.didSaveRecord(store, record);
      return dbStore['delete'](self.dbId(record));
    });
  },


  didSaveRecord: function(store, record, hash) {
    record.eachAssociation(function(name, meta) {
      if (meta.kind === 'belongsTo') {
        store.didUpdateRelationship(record, name);
      }
    });
  },

  /**
     The main hook for finding a single record. The `findMany`
     hook defaults to delegating to this method.

     Since the IndexedDB database is local, we don't need to
     implement a specific `findMany` method.

     @param {DS.Store} store
     @param {Class} type
     @param {String|Number} id
  */
  find: function(store, type, id) {
    var dbStore = this.getDbStore();
    var dbId = this.dbId(type, id);
    var self = this;

    var request = dbStore.get(dbId);
    request.onerror = function(event) {
      throw new Error("An attempt to read " + type + " with id " + id + " failed");
    };
    request.onsuccess = function(event) {
      var hash = request.result;
      self.didFindRecord(store, type, hash, id);
    };
  },

  didFindRecord: function(store, type, hash, id) {
    if (hash) {
      store.load(type, hash);
    }
  },

  findMany: function(store, type, ids) {
    var cursor, records = [], self = this;

    var isMatchingId = function(hash) {
      return ids.indexOf(cursor.id[1]) !== -1;
    };

    var onSuccess = function(event) {
      if (cursor = event.target.result) {
        if (isMatchingId(cursor.id)) {
          records.pushObject(cursor.value);
        }
        cursor.continue();
      } else {
        self.didFindMany(store, type, records);
      }
    };

    this.read(store, type, onSuccess);
  },

  didFindMany: function(store, type, records) {
    store.loadMany(type, records);
  },

  findAll: function(store, type) {
    var cursor, records = [], self = this;

    var onSuccess = function(event) {
      if (cursor = event.target.result) {
        records.pushObject(cursor.value);
        cursor.continue();
      } else {
        self.didFindAll(store, type, records);
      }
    };

    this.read(store, type, onSuccess);
  },

  didFindAll: function(store, type, records) {
    store.loadMany(type, records);
  },

  /**
   Using a cursor that loops through *all* results, comparing each one against the query. 
   TODO: For performance reasons we should use indexes on query attributes.
   (https://developer.mozilla.org/en-US/docs/IndexedDB/Using_IndexedDB#Using_an_index)

   @param {DS.Store} store
   @param {Class} type
   @param {Object} query
   @param {Array} array
  */
  findQuery: function(store, type, query, array) {
    var match = function(hash, query) {
      result = true;
      for (var key in query) {
        if (query.hasOwnProperty(key)) {
          result = result && (hash[key] === query[key]);
        }
      }
      return result;
    };

    var cursor, records = [], self = this;
    var onSuccess = function(event) {
      if (cursor = event.target.result) {
        if (match(cursor.value, query)) {
          records.pushObject(cursor.value);
        }
        cursor.continue();
      } else {
        self.didFindQuery(store, type, array, records);
      }
    };

    this.read(store, type, onSuccess);
  },

  didFindQuery: function(store, type, array, records) {
    array.load(records);
  },  

  /**
    Main hook for querying the database
  */
  read: function(store, type, onSuccess, onError) {
    var dbStore = this.getDbStore();
    var request = this.buildRequest(dbStore, type);

    onError = onError || function(event) {
      Ember.warning("indexedDB adapter error on querying for type " + type);
    };

    request.onsuccess = onSuccess;
    request.onerror = onError;
  },

  /**
    Return the indexedDB store object
  */
  getDbStore: function() {
    var db = get(this, 'db'),
    dbName = get(this, 'dbName'),
    dbTransaction = db.transaction([dbName]);

    return dbTransaction.objectStore(dbName);
  },

  buildRequest: function(dbStore, type) {
    // Index on modelType for faster querying
    var index = dbStore.index('_type');
    var IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange;
    var onlyOfType = IDBKeyRange.only(type.toString());

    return request = index.openCursor(onlyOfType);
  },

  /**
    @private

    Execute some code in the context of an IndexedDB
    transaction. Because operations on an IndexedDB
    database are done on a database's store, this
    method creates a new database transaction, extracts
    its `ember-records` object store and passes it to
    the callback.

    @param {Function} callback a function invoked with
      an IndexedDB object store. Its `this` is set to
      this adapter. This callback is expected to return
      an `IDBRequest` object that is the result of making
      a request on the object store.

    @returns {IDBRequest} An IndexedDB request, such as
      a get, put or delete operation.
  */
  withDbTransaction: function(callback) {
    var db = get(this, 'db'),
    dbName = get(this, 'dbName');

    var readwrite = (typeof IDBTransaction !== "undefined") ? IDBTransaction.READ_WRITE : 'readwrite';
    var dbTransaction = db.transaction( [dbName], readwrite);
    var dbStore = dbTransaction.objectStore(dbName);

    return callback.call(this, dbStore);
  },

  /**
    @private

    Attempt to commit a change to a single Ember Data
    record in the context of an IndexedDB transaction.
    This method delegates most of its work to
    `withDbTransaction`.

    It registers a `success` callback on the `IDBRequest`
    returned by `withDbTransaction`, which notifies the
    Ember Data store that the record was successfully
    saved.

    @param {DS.Store} store the store to notify that the
      record was successfully saved to IndexedDB.
    @param {DS.Model} record the record to save. This
      parameter is passed through to the store's
      `didSaveRecord` method if the IndexedDB request
      succeeds.
    @param {Function} callback a function that actually
      makes a request to the IndexedDB database. It is
      invoked with an `IDBObjectStore`, and is expected
      to return an `IDBRequest`.
  */
  attemptDbTransaction: function(store, record, callback) {
    var dbRequest = this.withDbTransaction(callback);

    dbRequest.addEventListener('success', function(s) {
      store.didSaveRecord(record);
    });
  },

  /**
    @private

    Returns true if the record in question is in any
    of the buckets in `commitDetails`.

    XXX include this on commitDetails? (i.e. `commitDetails.any(record)`)

    @param {DS.Model} record
    @param {Object} commitDetails a commitDetails hash
      passed to this adapter.

    @returns {Boolean}
  */
  any: function(record, commitDetails) {
    // null can never be in commitDetails, and it
    // doesn't require any special commit handling
    if (record === null) { return true; }

    if (commitDetails.created.has(record)) {
      return true;
    }

    if (commitDetails.updated.has(record)) {
      return true;
    }

    if (commitDetails.deleted.has(record)) {
      return true;
    }
  },

  /**
    @private

    Happens if a record's parent is deleted but the children are
    not yet materialized. In server-backed cases, this would normally
    be handled by the server, but as we are maintaining both sides of
    the relationship via the adapter, we have to manage unloaded records
    as well.

    @param {DS.Store} store
    @param {DS.OneToManyChange} relationship
  */
  updateChildRelationship: function(store, relationship) {
    var child = relationship.getChildTypeAndId(),
        parent = relationship.getNewParentTypeAndId(),
        parentId = parent ? parent[1] : null;

    this.updateUnloadedRelationship(child, relationship, function(hash) {
      var key = get(this, 'serializer')._keyForBelongsTo(child[0], relationship.getBelongsToName());
      hash[key] = parentId;
    });
  },

  /**
    @private

    Happens if a record is deleted but its old parent in the
    relationship is unloaded. In relational backends, this would
    take care of itself, because the parent side is just
    computed from an FK that no longer exists. In other
    server-backed cases, an adapter might want to notify the
    server of the change so it can update its parent-side array.

    @param {DS.Store} store
    @param {DS.OneToManyChange} relationship
  */
  updateOldParentRelationship: function(store, relationship) {
    var oldParent = relationship.getOldParentTypeAndId(),
        child = relationship.getChildTypeAndId(),
        childId = child ? child[1] : null;

    this.updateUnloadedRelationship(oldParent, relationship, function(hash) {
      var key = get(this, 'serializer')._keyForHasMany(oldParent[0], relationship.getHasManyName());
      var index = Ember.ArrayPolyfills.indexOf.call(hash[key], childId);
      if (index >= 0) { hash[key].splice(index, 1); }
    });
  },

  /**
    @private

    XXX Is this possible? Should it be possible?

    @param {DS.Store} store
    @param {DS.OneToManyChange} relationship
  */
  updateNewParentRelationship: function(store, relationship) {
    var newParent = relationship.getNewParentTypeAndId(),
        child = relationship.getChildTypeAndId(),
        childId = child ? child[1] : null;

    this.updateUnloadedRelationship(newParent, relationship, function(hash) {
      var key = get(this, 'serializer')._keyForHasMany(newParent[0], relationship.getHasManyName());
      var index = Ember.ArrayPolyfills.indexOf.call(hash[key], childId);
      if (index === -1) { hash[key].push(childId); }
    });
  },

  /**
    @private

    Used by other update*Relationship methods.

    @param {Array(Class, String)} updating a two-element array
      whose first element is the type of the record being
      updated, and whose second element is the id of the record.
    @param {OneToManyChange} relationship the change record that
      contains the information being updated. This method notifies
      the change record that it is doing some persistence work
      for a record not in the `commitDetails`, and lets it know
      when that work is done.
    @param {Function} callback a callback that is called with
      the current version of record in IndexedDB and with its
      `this` set to this adapter. Any mutations to hash
      performed in the callback will be persisted back to the
      IndexedDB database.
  */
  updateUnloadedRelationship: function(updating, relationship, callback) {
    // make sure that we successfully make the change before marking any
    // materialized records that are part of the transaction as clean.
    relationship.wait();

    var updatingDbId = updating.slice(), self = this;
    updatingDbId[0] = updatingDbId[0].toString();

    var lookup = this.withDbTransaction(function(dbStore) {
      return dbStore.get(updatingDbId);
    });

    lookup.addEventListener('error', function() {
      throw new Error("An attempt to update " + updatingDbId[0] + " with id " + updatingDbId[1] + " failed");
    });

    var self = this;
    lookup.addEventListener('success', function() {
      var hash = lookup.result;

      if (hash) {
        callback.call(self, hash);

        var put = self.withDbTransaction(function(dbStore) {
          return dbStore.put(hash);
        });

        put.addEventListener('error', function() {
        });

        put.addEventListener('success', function() {
          relationship.done();
        });
      } else {
        throw new Error("An attempt to update " + updatingDbId[0] + " with id " + updatingDbId[1] + " failed");
      }
    });
  }
});
})();



(function() {

})();



(function() {

})();

(function() {
//     node-uuid/uuid.js
//
//     Copyright (c) 2010 Robert Kieffer
//     Dual licensed under the MIT and GPL licenses.
//     Documentation and details at https://github.com/broofa/node-uuid
(function() {
  var _global = this;

  // Unique ID creation requires a high quality random # generator, but
  // Math.random() does not guarantee "cryptographic quality".  So we feature
  // detect for more robust APIs, normalizing each method to return 128-bits
  // (16 bytes) of random data.
  var mathRNG, nodeRNG, whatwgRNG;

  // Math.random()-based RNG.  All platforms, very fast, unknown quality
  var _rndBytes = new Array(16);
  mathRNG = function() {
    var r, b = _rndBytes, i = 0;

    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) == 0) r = Math.random() * 0x100000000;
      b[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return b;
  }

  // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
  // WebKit only (currently), moderately fast, high quality
  if (_global.crypto && crypto.getRandomValues) {
    var _rnds = new Uint32Array(4);
    whatwgRNG = function() {
      crypto.getRandomValues(_rnds);

      for (var c = 0 ; c < 16; c++) {
        _rndBytes[c] = _rnds[c >> 2] >>> ((c & 0x03) * 8) & 0xff;
      }
      return _rndBytes;
    }
  }

  // Node.js crypto-based RNG - http://nodejs.org/docs/v0.6.2/api/crypto.html
  // Node.js only, moderately fast, high quality
  try {
    var _rb = require('crypto').randomBytes;
    nodeRNG = _rb && function() {
      return _rb(16);
    };
  } catch (e) {}

  // Select RNG with best quality
  var _rng = nodeRNG || whatwgRNG || mathRNG;

  // Buffer class to use
  var BufferClass = typeof(Buffer) == 'function' ? Buffer : Array;

  // Maps for number <-> hex string conversion
  var _byteToHex = [];
  var _hexToByte = {};
  for (var i = 0; i < 256; i++) {
    _byteToHex[i] = (i + 0x100).toString(16).substr(1);
    _hexToByte[_byteToHex[i]] = i;
  }

  // **`parse()` - Parse a UUID into it's component bytes**
  function parse(s, buf, offset) {
    var i = (buf && offset) || 0, ii = 0;

    buf = buf || [];
    s.toLowerCase().replace(/[0-9a-f]{2}/g, function(byte) {
      if (ii < 16) { // Don't overflow!
        buf[i + ii++] = _hexToByte[byte];
      }
    });

    // Zero out remaining bytes if string was short
    while (ii < 16) {
      buf[i + ii++] = 0;
    }

    return buf;
  }

  // **`unparse()` - Convert UUID byte array (ala parse()) into a string**
  function unparse(buf, offset) {
    var i = offset || 0, bth = _byteToHex;
    return  bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]];
  }

  // **`v1()` - Generate time-based UUID**
  //
  // Inspired by https://github.com/LiosK/UUID.js
  // and http://docs.python.org/library/uuid.html

  // random #'s we need to init node and clockseq
  var _seedBytes = _rng();

  // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
  var _nodeId = [
    _seedBytes[0] | 0x01,
    _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
  ];

  // Per 4.2.2, randomize (14 bit) clockseq
  var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

  // Previous uuid creation time
  var _lastMSecs = 0, _lastNSecs = 0;

  // See https://github.com/broofa/node-uuid for API details
  function v1(options, buf, offset) {
    var i = buf && offset || 0;
    var b = buf || [];

    options = options || {};

    var clockseq = options.clockseq != null ? options.clockseq : _clockseq;

    // UUID timestamps are 100 nano-second units since the Gregorian epoch,
    // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
    // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
    // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
    var msecs = options.msecs != null ? options.msecs : new Date().getTime();

    // Per 4.2.1.2, use count of uuid's generated during the current clock
    // cycle to simulate higher resolution clock
    var nsecs = options.nsecs != null ? options.nsecs : _lastNSecs + 1;

    // Time since last uuid creation (in msecs)
    var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

    // Per 4.2.1.2, Bump clockseq on clock regression
    if (dt < 0 && options.clockseq == null) {
      clockseq = clockseq + 1 & 0x3fff;
    }

    // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
    // time interval
    if ((dt < 0 || msecs > _lastMSecs) && options.nsecs == null) {
      nsecs = 0;
    }

    // Per 4.2.1.2 Throw error if too many uuids are requested
    if (nsecs >= 10000) {
      throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
    }

    _lastMSecs = msecs;
    _lastNSecs = nsecs;
    _clockseq = clockseq;

    // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
    msecs += 12219292800000;

    // `time_low`
    var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
    b[i++] = tl >>> 24 & 0xff;
    b[i++] = tl >>> 16 & 0xff;
    b[i++] = tl >>> 8 & 0xff;
    b[i++] = tl & 0xff;

    // `time_mid`
    var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
    b[i++] = tmh >>> 8 & 0xff;
    b[i++] = tmh & 0xff;

    // `time_high_and_version`
    b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
    b[i++] = tmh >>> 16 & 0xff;

    // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
    b[i++] = clockseq >>> 8 | 0x80;

    // `clock_seq_low`
    b[i++] = clockseq & 0xff;

    // `node`
    var node = options.node || _nodeId;
    for (var n = 0; n < 6; n++) {
      b[i + n] = node[n];
    }

    return buf ? buf : unparse(b);
  }

  // **`v4()` - Generate random UUID**

  // See https://github.com/broofa/node-uuid for API details
  function v4(options, buf, offset) {
    // Deprecated - 'format' argument, as supported in v1.2
    var i = buf && offset || 0;

    if (typeof(options) == 'string') {
      buf = options == 'binary' ? new BufferClass(16) : null;
      options = null;
    }
    options = options || {};

    var rnds = options.random || (options.rng || _rng)();

    // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;

    // Copy bytes to buffer, if provided
    if (buf) {
      for (var ii = 0; ii < 16; ii++) {
        buf[i + ii] = rnds[ii];
      }
    }

    return buf || unparse(rnds);
  }

  // Export public API
  var uuid = v4;
  uuid.v1 = v1;
  uuid.v4 = v4;
  uuid.parse = parse;
  uuid.unparse = unparse;
  uuid.BufferClass = BufferClass;

  // Export RNG options
  uuid.mathRNG = mathRNG;
  uuid.nodeRNG = nodeRNG;
  uuid.whatwgRNG = whatwgRNG;

  if (typeof(module) != 'undefined') {
    // Play nice with node.js
    module.exports = uuid;
  } else {
    // Play nice with browsers
    var _previousRoot = _global.uuid;

    // **`noConflict()` - (browser only) to reset global 'uuid' var**
    uuid.noConflict = function() {
      _global.uuid = _previousRoot;
      return uuid;
    }
    _global.uuid = uuid;
  }
}());

})();



(function() {

})();

