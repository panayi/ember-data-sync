OfflineReader::Application.routes.draw do
  root :to => 'rsses#index'

  resources :users
  resources :pages
  resources :rsses
end
