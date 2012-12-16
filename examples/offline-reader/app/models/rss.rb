require 'feedzirra'

class Rss < ActiveRecord::Base
	has_many :pages
  attr_accessible :uuid, :name, :url

  before_create :create_uuid, :fetch_feed

  self.primary_key = "uuid"

  def self.modified_after(modified_after)
  	modified_after = DateTime.parse modified_after
  	self.where("updated_at > :time OR deleted_at > :time", {:time => modified_after})
  end

  def fetch_feed
  	if url = self.url
  		feed = Feedzirra::Feed.fetch_and_parse(url)

  		if feed
	  		self.name = feed.title
	  	end
  	end
  end

  def create_uuid
  	self.uuid ||= UUID.new.generate
  end

  def refresh
    feed = Feedzirra::Feed.fetch_and_parse(self.url)

    if feed
      feed.entries.each do |entry|
        if Page.find_by_url(entry.url).nil?
          page = Page.create!(:url => entry.url, :title => entry.title)
          page.rss = self
          page.save
          self.pages << page
        end
      end
    end
  end
end
