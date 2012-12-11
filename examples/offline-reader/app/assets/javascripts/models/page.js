OfflineReader.Page = DS.Model.extend({
  url: DS.attr('string'),
  title: DS.attr('string'),
  body: DS.attr('string'),
  rss: DS.attr('references')
});