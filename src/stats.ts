let _messageCount = 0
let _lastRestart = new Date()

export default {
  getMessageCount: () => _messageCount,
  getLastRestart: () => _lastRestart,
  incrementMessageCount: () => {
    _messageCount++
  },
}
