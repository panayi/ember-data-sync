OfflineReader::Application.routes.draw do
  root :to => 'rsses#index'

  resources :pages
  resources :rsses

  match "/sync" => 'sync#all_modified_after'
end
