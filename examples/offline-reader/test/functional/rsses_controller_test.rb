require 'test_helper'

class RssesControllerTest < ActionController::TestCase
  setup do
    @rss = rsses(:one)
  end

  test "should get index" do
    get :index
    assert_response :success
    assert_not_nil assigns(:rsses)
  end

  test "should get new" do
    get :new
    assert_response :success
  end

  test "should create rss" do
    assert_difference('Rss.count') do
      post :create, rss: { name: @rss.name, url: @rss.url }
    end

    assert_redirected_to rss_path(assigns(:rss))
  end

  test "should show rss" do
    get :show, id: @rss
    assert_response :success
  end

  test "should get edit" do
    get :edit, id: @rss
    assert_response :success
  end

  test "should update rss" do
    put :update, id: @rss, rss: { name: @rss.name, url: @rss.url }
    assert_redirected_to rss_path(assigns(:rss))
  end

  test "should destroy rss" do
    assert_difference('Rss.count', -1) do
      delete :destroy, id: @rss
    end

    assert_redirected_to rsses_path
  end
end
