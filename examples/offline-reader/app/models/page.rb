class Page < ActiveRecord::Base
  belongs_to :rss
  attr_accessible :body, :title, :url
end
