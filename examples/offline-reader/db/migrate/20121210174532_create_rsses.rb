class CreateRsses < ActiveRecord::Migration
  def change
    create_table :rsses do |t|
      t.string :uuid, :unique => true
      t.string :url
      t.string :name

      t.timestamps
      t.column :deleted_at, :datetime
    end
    add_index :rsses, :uuid, :unique => true
  end
end
