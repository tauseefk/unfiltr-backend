'use strict'

import { v1 } from 'uuid'
import Stream from 'observable-stream'
import {
  delay,
  keyIs,
  getRandomColor,
  promisifiedRAF,
  takeContinuousN,
  noOp,
} from './utils'
import { events } from '../events'

const port = window.location.port ? ':' + window.location.port : ''
const host = `${window.location.hostname}${port}`
const socket = io.connect(host)
let messagesEl: HTMLElement = null
let textInputEl = null
let sendButtonEl = null
let userId = null
let titleEl = null
let activeUsersEl = null
const activeUsers = new Map()

const keyIsEnter = keyIs('Enter')

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

type Connection = { userId: string }
const $userConnection = new Stream<Connection>((observer) => {
  socket.on(events.USER_CONNECTED, observer.next)
  socket.on(events.USER_CONNECTED, observer.complete)
})

const $userDisconnection = new Stream<Connection>((observer) => {
  socket.on(events.USER_DISCONNETED, observer.next)
  socket.on(events.USER_DISCONNETED, observer.complete)
})

type Message = { id: string; message: string; from: string }
const $messages = new Stream<Message>((observer) => {
  socket.on(events.NEW_MESSAGE, observer.next)
  socket.on(events.DISCONNECT, observer.complete)
})

const $userTypingStart = new Stream((observer) => {
  socket.on(events.TYPING, observer.next)
  socket.on(events.TYPING, observer.complete)
})

const $userTypingStop = new Stream((observer) => {
  socket.on(events.STOPPED_TYPING, observer.next)
  socket.on(events.STOPPED_TYPING, observer.complete)
})

const $messageId = new Stream((observer) => {
  socket.on(events.MESSAGE_ID, observer.next)
})

type EmphasizeMessage = { id: string }
const $emphasizeMessage = new Stream<EmphasizeMessage>((observer) => {
  socket.on(events.EMPHASIZE_MESSAGE, observer.next)
})

/**
 * Adds the message to the chat, and scrolls it into view.
 * Just DOM operations.
 * @param {object} { message, id }
 * @param {boolean} isOwn
 */
const addMessageToChat = ({ message, id, from }: Message) => {
  if (!message) return
  const isOwn = userId === from

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

  const $textInput = Stream.fromEvent(
    'keydown',
    textInputEl,
  ) as Stream<KeyboardEvent>
  const $sendButtonClick = Stream.fromEvent('click', sendButtonEl)
  const $messageClick = Stream.fromEvent(
    'click',
    messagesEl,
  ) as Stream<MouseEvent>

  promisifiedRAF()
    .then(() => titleEl.classList.add('u-fade'))
    .then(delayShort)
    .then(() => (titleEl.style.display = 'none'))

  textInputEl.focus()
  textInputEl.select()

  $userConnection.subscribe({
    next: addToActiveUsers,
    complete: noOp,
  })

  $userDisconnection.subscribe({
    next: removeFromActiveUsers,
    complete: noOp,
  })

  $textInput
    .filter((e) => keyIsEnter(e.code))
    .map((e) => {
      const target = e.target as HTMLTextAreaElement
      return {
        message: target.value.trim(),
        e,
        textEl: target,
        id: v1(),
      }
    })
    .subscribe({
      next: ({ message, id, textEl, e }) => {
        e.preventDefault()
        emitNewMessage({ message, textEl, id })
        addMessageToChat({ message, id, from: userId })
      },
      complete: noOp,
    })

  $textInput
    .filter((e) => !keyIsEnter(e.code))
    .subscribe({
      next: emitTyping,
      complete: noOp,
    })

  $sendButtonClick
    .map(() => ({ message: textInputEl.value.trim(), textEl: textInputEl }))
    .subscribe({
      next: ({ message, textEl }) => {
        const id = v1()
        emitNewMessage({ message, id, textEl })
        addMessageToChat({ message, id, from: userId })
      },
      complete: noOp,
    })

  $messages
    .filter(({ from }) => from !== userId)
    .subscribe({
      next: addMessageToChat,
      complete: noOp,
    })

  $messageId.subscribe({ next: updateMessageId, complete: noOp })

  $messageClick
    .filter((e) => {
      const target = e.target as HTMLDivElement
      return (
        target &&
        target.classList.contains('j-message') &&
        target.classList.contains('owner-self')
      )
    })
    .filter(takeContinuousN(5))
    .map((e) => {
      const target = e.target as HTMLDivElement
      return { target, id: target.id }
    })
    .subscribe({
      next: emphasizeOwnMessage,
      complete: noOp,
    })

  $emphasizeMessage.subscribe({
    next: emphasizeMessage,
    complete: noOp,
  })

  $userTypingStart.subscribe({
    next: startTyping,
    complete: noOp,
  })

  $userTypingStop.subscribe({
    next: stopTyping,
    complete: noOp,
  })
})
