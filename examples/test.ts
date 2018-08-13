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
  .on('room-join', async function (this, room, inviteeList, inviter) {
    log.info('room-join', 'room\'s name:%s, inviteeList=%s, inviter=%s',
    await room.topic(), JSON.stringify(inviteeList), inviter.name())
  })
  .on('room-leave', async function (this, room, leaverList) {
    log.info('room-leave', 'room\'s name:%s, inviteeList=%s',
    await room.topic(), JSON.stringify(leaverList))
  })
  .on('room-topic', async function (this, room, newTopic, oldTopic, changer) {
    await room.ready(true)
    log.info('room-topic', 'room\'s new name:%s, oldName=%s, changer=%s',
    (await room.topic()), oldTopic, changer.name())
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

start().then(() => { return }).catch(() => { return })
