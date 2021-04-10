'use strict'

import keyCodes from './keycodes'

const promisifiedRAF = (): Promise<number> => new Promise(requestAnimationFrame)

const delay = (ms: number) => (res: any): Promise<any> =>
  new Promise((resolve) => {
    window.setTimeout(() => resolve(res), ms)
  })

const debounce = (fn: Function, ms: number): Function => {
  let timer: number
  return (...args: any[]): void => {
    if (timer) clearTimeout(timer)
    timer = window.setTimeout(fn.bind(null, ...args), ms)
  }
}

const getRandomColor = (): string =>
  '#' + ((Math.random() * 16777215) << 0).toString(16)

const branchInto = (a: Function, b: Function): Function => (
  condition: boolean,
): Function => (_: any) =>
  condition ? Promise.resolve(a(_)) : Promise.resolve(b(_))

const keyIs = (key: string): Function => (keyCode: number): boolean =>
  keyCodes[keyCode] === key

const takeContinuousN = (n: number, ms: number = 300) => {
  let _count: number = 0
  let _resetCountTimer: number | undefined

  return (): boolean => {
    if (++_count >= n) {
      _count = 0
      window.clearTimeout(_resetCountTimer)
      return true
    }

    if (_resetCountTimer) window.clearTimeout(_resetCountTimer)
    _resetCountTimer = window.setTimeout(() => {
      _count = 0
    }, ms)
    return false
  }
}

const noOp = () => {}

export {
  promisifiedRAF,
  delay,
  debounce,
  getRandomColor,
  branchInto,
  keyIs,
  takeContinuousN,
  noOp,
}
