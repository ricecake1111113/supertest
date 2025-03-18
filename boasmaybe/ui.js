var AD_STATUS = {
  NONE: 0,
  CLOSE_FINISHED: 1,
  CLOSE_ABORTED: 2,
  ERROR: 3,
}

function onShowUI() {
  
}

function onHideUI() {
  
}

function onGameLoaded() {
  
}

function hideProgress() {
 
}

function playButtonClicked(from) {
  sendClickEvent('game', 'play')
  startGameFromScreen = from
  StartGame(startGameFromScreen)
}

function sendClickEvent(category, label) {
  window.ga && window.ga('send', 'event', category, 'Clicked', label)
}

function StartGame(target) {
	gameInstance.SendMessage('GameManager', 'StartGame', parseInt(target, 10))
}

function getFetchResult() {
	return true
}

function showVideoAd(from) {
	rewardedAdFrom = from
	gameInstance.SendMessage('WebGLAdManager', 'FireWebAdEvent', 1 + '/' + (rewardedAdFrom))
}