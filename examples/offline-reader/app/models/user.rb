class User < ActiveRecord::Base
	has_and_belongs_to_many :rsses
  attr_accessible :username
end
