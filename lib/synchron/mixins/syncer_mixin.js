var get = Ember.get, set = Ember.set;

DS._SyncerMixin = Ember.Mixin.create({
  internalDataForRecord: function(array, type, id) {
    type = type.toString();

    return array.find(function(hash) {
      return hash.recordType === type && hash.recordId = id;
    });
  }
});

