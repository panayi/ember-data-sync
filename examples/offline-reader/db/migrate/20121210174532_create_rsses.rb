class CreateRsses < ActiveRecord::Migration
  def change
    create_table :rsses do |t|
      t.string :url
      t.string :name

      t.timestamps
    end
  end
end
