# encoding: UTF-8
# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# Note that this schema.rb definition is the authoritative source for your
# database schema. If you need to create the application database on another
# system, you should be using db:schema:load, not running all the migrations
# from scratch. The latter is a flawed and unsustainable approach (the more migrations
# you'll amass, the slower it'll run and the greater likelihood for issues).
#
# It's strongly recommended to check this file into your version control system.

ActiveRecord::Schema.define(:version => 20121210174849) do

  create_table "pages", :force => true do |t|
    t.string   "uuid"
    t.string   "url"
    t.string   "title"
    t.text     "body"
    t.string   "rss_id"
    t.datetime "created_at", :null => false
    t.datetime "updated_at", :null => false
    t.datetime "deleted_at"
  end

  add_index "pages", ["rss_id"], :name => "index_pages_on_rss_id"
  add_index "pages", ["uuid"], :name => "index_pages_on_uuid", :unique => true

  create_table "rsses", :force => true do |t|
    t.string   "uuid"
    t.string   "url"
    t.string   "name"
    t.datetime "created_at", :null => false
    t.datetime "updated_at", :null => false
    t.datetime "deleted_at"
  end

  add_index "rsses", ["uuid"], :name => "index_rsses_on_uuid", :unique => true

end
