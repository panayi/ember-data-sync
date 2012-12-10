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