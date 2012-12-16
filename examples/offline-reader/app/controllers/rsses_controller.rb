class RssesController < ApplicationController
  def index
    # home
  end

  # POST /rsses
  # POST /rsses.json
  def create
    @rss = Rss.new(params[:rss])
    @rss.uuid = params[:rss][:id]
    respond_to do |format|
      if @rss.save
        format.html { redirect_to @rss, notice: 'Rss was successfully created.' }
        format.json { render json: @rss, status: :created, location: @rss }
      else
        format.html { render action: "new" }
        format.json { render json: @rss.errors, status: :unprocessable_entity }
      end
    end
  end

  # PUT /rsses/1
  # PUT /rsses/1.json
  def update
    @rss = Rss.find_by_uuid(params[:id])

    respond_to do |format|
      if @rss.update_attributes(params[:rss])
        format.html { redirect_to @rss, notice: 'Rss was successfully updated.' }
        format.json { head :no_content }
      else
        format.html { render action: "edit" }
        format.json { render json: @rss.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /rsses/1
  # DELETE /rsses/1.json
  def destroy
    @rss = Rss.find_by_uuid(params[:id])
    @rss.destroy

    respond_to do |format|
      format.html { redirect_to rsses_url }
      format.json { head :no_content }
    end
  end
end
