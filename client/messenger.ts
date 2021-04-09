'use strict'

import uuid from 'uuid/v1'
import Stream from 'observable-stream'
import { delay, keyIs, getRandomColor, promisifiedRAF, takeContinuousN } from './utils'
import { events } from '../events'

const port = window.location.port ? ':' + window.location.port : ''
const host = `${window.location.hostname}${port}`
const socket = io.connect(host)
let messagesEl = null
let textInputEl = null
let sendButtonEl = null
let userId = null
let titleEl = null
let activeUsersEl = null
const activeUsers = new Map()

const keyIsEnter = keyIs('enter')

const delayShort = delay(1000)
const delayTiny = delay(250)

socket.on(events.INFO, ({ id, connectedUsers }) => {
  userId = id
  connectedUsers
    .filter((user) => user !== userId)
    .forEach((user) => {
      addToActiveUsers({ userId: user })
    })
})

const $connections = new Stream((observer) => {
  socket.on(events.USER_CONNECTED, observer.next)
  socket.on(events.USER_DISCONNETED, observer.complete)
})

const $messages = new Stream((observer) => {
  socket.on(events.NEW_MESSAGE, observer.next)
  socket.on(events.DISCONNECT, observer.complete)
})

const $userTyping = new Stream((observer) => {
  socket.on(events.TYPING, observer.next)
  socket.on(events.STOPPED_TYPING, observer.complete)
})

const $messageId = new Stream((observer) => {
  socket.on(events.MESSAGE_ID, observer.next)
})

const $emphasizeMessage = new Stream((observer) => {
  socket.on(events.EMPHASIZE_MESSAGE, observer.next)
})

/**
 * Adds the message to the chat, and scrolls it into view.
 * Just DOM operations.
 * @param {object} { message, id }
 * @param {boolean} isOwn
 */
const addMessageToChat = ({ message, id }, isOwn) => {
  if (!message) return

  const mEl = document.createElement('div')
  mEl.textContent = message
  messagesEl.appendChild(mEl)
  mEl.classList.add('j-message')
  mEl.id = id
  isOwn ? mEl.classList.add('owner-self') : mEl.classList.add('owner-other')
  promisifiedRAF().then(() => mEl.classList.add('visible'))
  mEl.scrollIntoView()
}

const updateMessageId = ({ id, updatedId }) => {
  const messageBubble = document.getElementById(id)
  messageBubble.classList.add('j-updated-id')
  messageBubble.id = updatedId
}

const emitTyping = () => {
  socket.emit(events.TYPING, { userId })
}

const emitNewMessage = ({ message, id, textEl }) => {
  socket.emit(events.NEW_MESSAGE, {
    from: userId,
    message,
    id,
  })
  textEl.value = ''
}

const addToActiveUsers = ({ userId }) => {
  if (activeUsers.has(userId)) return

  const userEl = document.createElement('span')
  userEl.classList.add('user', 'u-float-right')
  userEl.style.backgroundColor = getRandomColor()
  activeUsersEl.appendChild(userEl)

  activeUsers.set(userId, userEl)
}

const removeFromActiveUsers = ({ userId }) => {
  if (!activeUsers.has(userId)) return

  activeUsers.get(userId).remove()
  activeUsers.delete(userId)
}

const startTyping = ({ userId }) => {
  if (!activeUsers.has(userId)) return

  activeUsers.get(userId).classList.add('typing')
}

const stopTyping = ({ userId }) => {
  if (!activeUsers.has(userId)) return

  activeUsers.get(userId).classList.remove('typing')
}

const emphasizeOwnMessage = ({ target, id }) => {
  target.classList.add('large')
  if (!target.classList.contains('j-updated-id')) {
    promisifiedRAF()
      .then(delayTiny)
      .then(() => {
        target.classList.remove('large')
      })
  } else {
    socket.emit(events.EMPHASIZE_MESSAGE, { id })
  }
}

const emphasizeMessage = ({ id }) => {
  const targetMessageBubble = document.getElementById(id)
  targetMessageBubble.classList.add('large')
}

document.addEventListener('DOMContentLoaded', () => {
  titleEl = document.getElementById('title')
  sendButtonEl = document.getElementById('send')
  activeUsersEl = document.getElementById('activeUsers')
  messagesEl = document.getElementById('messages')
  textInputEl = document.getElementById('textInput')

  const $textInput = Stream.fromEvent('keydown', textInputEl)
  const $sendButtonClick = Stream.fromEvent('click', sendButtonEl)
  const $messageClick = Stream.fromEvent('click', messagesEl)

  promisifiedRAF()
    .then(() => titleEl.classList.add('u-fade'))
    .then(delayShort)
    .then(() => (titleEl.style.display = 'none'))

  textInputEl.focus()
  textInputEl.select()

  $connections.subscribe({
    next: addToActiveUsers,
    complete: removeFromActiveUsers,
  })

  $textInput
    .filter((e) => keyIsEnter(e.keyCode))
    .map((e) => ({ message: e.target.value.trim(), e, textEl: e.target, id: uuid() }))
    .subscribe({
      next: ({ message, id, textEl, e }) => {
        e.preventDefault()
        emitNewMessage({ message, textEl, id })
        addMessageToChat({ message, id }, true)
      },
    })

  $textInput
    .filter((e) => !keyIsEnter(e.keyCode))
    .subscribe({
      next: emitTyping,
      complete: () => {},
    })

  $sendButtonClick
    .map(() => ({ message: textInputEl.value.trim(), textEl: textInputEl }))
    .subscribe({
      next: ({ message, textEl }) => {
        const id = uuid()
        emitNewMessage({ message, id, textEl })
        addMessageToChat({ message, id }, true)
      },
      complete: () => {},
    })

  $messages
    .filter(({ from }) => from !== userId)
    .subscribe({
      next: addMessageToChat,
      complete: () => {},
    })

  $messageId.subscribe({ next: updateMessageId })

  $messageClick
    .filter(
      (e) =>
        e.target &&
        e.target.classList.contains('j-message') &&
        e.target.classList.contains('owner-self')
    )
    .filter(takeContinuousN(5))
    .map((e) => ({ target: e.target, id: e.target.id }))
    .subscribe({
      next: emphasizeOwnMessage,
      complete: () => {},
    })

  $emphasizeMessage.subscribe({
    next: ({ id }) => {
      emphasizeMessage({ id })
    },
  })

  $userTyping.subscribe({
    next: startTyping,
    complete: stopTyping,
  })
})
