OfflineReader.RssView = Ember.View.extend({
  templateName: 'rss',
  classNameBindings: 'isActive:active',

  isActive: function() {
  	return OfflineReader.router.rssController.get('id') === this.get('controller.id');
  }.property('OfflineReader.router.rssController.id', 'controller.id')
});
