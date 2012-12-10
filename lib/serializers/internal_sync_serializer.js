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