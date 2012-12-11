class RssesController < ApplicationController
  # GET /rsses
  # GET /rsses.json
  def index
    @rsses = Rss.all

    respond_to do |format|
      format.html # index.html.erb
      format.json { render json: @rsses }
    end
  end

  # GET /rsses/1
  # GET /rsses/1.json
  def show
    @rss = Rss.find(params[:id])

    respond_to do |format|
      format.html # show.html.erb
      format.json { render json: @rss }
    end
  end

  # GET /rsses/new
  # GET /rsses/new.json
  def new
    @rss = Rss.new

    respond_to do |format|
      format.html # new.html.erb
      format.json { render json: @rss }
    end
  end

  # GET /rsses/1/edit
  def edit
    @rss = Rss.find(params[:id])
  end

  # POST /rsses
  # POST /rsses.json
  def create
    @rss = Rss.new(params[:rss])

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
    @rss = Rss.find(params[:id])

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
    @rss = Rss.find(params[:id])
    @rss.destroy

    respond_to do |format|
      format.html { redirect_to rsses_url }
      format.json { head :no_content }
    end
  end
end
