OfflineReader.RssUser = DS.Model.extend({
  rss: DS.attr('references'),
  user: DS.attr('references')
});