class PageSerializer < ActiveModel::Serializer
  attributes :id, :url, :title, :body
  has_one :rss
end
