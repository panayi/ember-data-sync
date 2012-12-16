require 'readability'
require 'open-uri'

class Page < ActiveRecord::Base
  belongs_to :rss
  attr_accessible :uuid, :body, :title, :url, :rss

  before_create :create_uuid, :fetch_body
  
  self.primary_key = "uuid"

  def self.modified_after(modified_after)
  	modified_after = DateTime.parse modified_after
  	self.where("updated_at > :time OR deleted_at > :time", {:time => modified_after})
  end

  def create_uuid
  	self.uuid ||= UUID.new.generate
  end

  def fetch_body
  	if url = self.url
  		source = open(url).read
  		self.body = Readability::Document.new(source, :tags => %w[div p img]).content
  	end
  end
end
