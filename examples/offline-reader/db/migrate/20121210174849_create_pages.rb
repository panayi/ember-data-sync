class CreatePages < ActiveRecord::Migration
  def change
    create_table :pages do |t|
      t.string :uuid, :unique => true
      t.string :url
      t.string :title
      t.text :body
      t.string :rss_id

      t.timestamps
      t.column :deleted_at, :datetime
    end
    add_index :pages, :uuid, :unique => true
    add_index :pages, :rss_id
  end
end
