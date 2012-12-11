class RssUser < ActiveRecord::Base
  belongs_to :rss
  belongs_to :user
  # attr_accessible :title, :body
end
