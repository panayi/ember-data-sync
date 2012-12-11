class CreatePages < ActiveRecord::Migration
  def change
    create_table :pages do |t|
      t.string :url
      t.string :title
      t.text :body
      t.references :rss

      t.timestamps
    end
    add_index :pages, :rss_id
  end
end
