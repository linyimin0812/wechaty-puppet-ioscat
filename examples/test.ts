import { Wechaty } from 'wechaty'
import { PuppetIoscat } from '../src/'

import { log } from '../src/config'

const puppet = new PuppetIoscat({
  token: 'wxid_tdax1huk5hgs12',
})

const wechaty = new Wechaty({ puppet })

wechaty.on('login', async (user) => {
  log.silly(`login: ${user}`)
})
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
  .on('error', (err) => {
    log.error(JSON.stringify(err))
  })

async function start () {
  await wechaty.start()
  const contact = await wechaty.Contact.find({ name: '林贻民' })
  if (contact) {
    // log.silly('发语音')
    // contact.say('hello')
  } else {
    log.silly('null')
  }

  const room = await wechaty.Room.find({ topic: '直播一群' })
  if (room) {
    log.silly('room 发消息')
    // room.say('hello')
  } else {
    log.silly('没有找到群')
  }

}

start()
