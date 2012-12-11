class CreateRssUsers < ActiveRecord::Migration
  def change
    create_table :rss_users do |t|
      t.references :rss
      t.references :user

      t.timestamps
    end
    add_index :rss_users, :rss_id
    add_index :rss_users, :user_id
  end
end
