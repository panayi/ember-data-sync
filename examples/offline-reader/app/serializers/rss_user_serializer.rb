class RssUserSerializer < ActiveModel::Serializer
  attributes :id
  has_one :rss
  has_one :user
end
