class RssSerializer < ActiveModel::Serializer
  attributes :id, :url, :name
end
