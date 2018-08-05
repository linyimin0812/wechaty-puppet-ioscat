import { Wechaty } from 'wechaty'
import { PuppetIoscat } from '../src/'

import { log } from '../src/config'

const puppet = new PuppetIoscat({
  token: 'xxxxxxxxxxxxx',
})

const wechaty = new Wechaty({ puppet })

wechaty.on('login', (user) => log.silly(`login: ${user}`))
  .on('message', async (msg) => {
    const from = msg.from()
    const to = msg.to()
    const room = msg.room()
    if (from) {
      log.silly('test', 'from: %s', from.name())
    }
    if (to) {
      log.silly('test', 'to: %s', to.name())
    }
    if (room) {
      log.silly('test', 'message: %s', await room.topic())
    }
  })

wechaty.start()
