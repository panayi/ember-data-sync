OfflineReader.Rss = DS.Model.extend({
  url: DS.attr('string'),
  name: DS.attr('string'),
  pages: DS.hasMany('OfflineReader.Page'),

  prettyName: function() {
    var url = this.get('url');
  	var name = this.get('name') || (url && url.replace('http://', '')) || '';
  	return name.length > 26 ? name.substring(0, 25) + '...' : name;
  }.property('url', 'name')
});