class Rss < ActiveRecord::Base
	has_and_belongs_to_many :users
  attr_accessible :name, :url
end
