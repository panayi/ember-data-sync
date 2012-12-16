class SyncController < ApplicationController
  def all_modified_after
    refresh_feeds

    max_modified = params[:max_modified]

    @rsses = Rss.modified_after max_modified
    @pages = Page.modified_after max_modified

    render :json => {
       :rsses => @rsses,
       :pages => @pages
    }
  end

  private

  def refresh_feeds
    Rss.all.each do |rss|
      rss.refresh
    end
  end
end
