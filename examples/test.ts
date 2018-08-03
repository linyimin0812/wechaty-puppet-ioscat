import { Wechaty } from 'wechaty'
import { PuppetIoscat } from '../src/'

import { log } from '../src/config'

const puppet = new PuppetIoscat({
  token: 'wxid_tdax1huk5hgs12',
})

const wechaty = new Wechaty({ puppet })

wechaty.on('login', (user) => log.silly(`login: ${user}`))
  .on('message', async (msg) => {
    const from = msg.from()
    const to = msg.to()
    const room = msg.room()
    if (from) {
      log.silly(from.name())
    }
    if (to) {
      log.silly(to.name())
    }
    if (room) {
      log.silly(await room.topic())
    }
  })

wechaty.start()
