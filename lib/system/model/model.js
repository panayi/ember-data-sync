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