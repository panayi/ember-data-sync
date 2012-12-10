DS._ModifiedRecordsHelpers = Ember.Mixin.create({
  eachModifiedRecord: function(commitDetails, callback, context) {

    ['created', 'updated', 'deleted'].forEach(function(bucketType) {
      commitDetails[bucketType].forEach(function(record) {
        callback.call(context, bucketType, record);
      }, context);
    }, context);
  }
});