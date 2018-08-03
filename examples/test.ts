import { Wechaty } from 'wechaty'
import { PuppetIoscat } from '../src/'

import { log } from '../src/config'

const puppet = new PuppetIoscat({
  token: 'xxx',
})

const wechaty = new Wechaty({ puppet })

wechaty.on('login', (user) => log.silly(`login: ${user}`))
.on('message', (msg) => {
  log.silly(`msg: ${msg}`)
})

wechaty.start()
