import { PuppetIoscat } from '../src/'

import { log } from '../src/config'

const puppet = new PuppetIoscat({
  token: 'wxid_tdax1huk5hgs12',
})

puppet.on('login', async (user) => {
  log.silly(`login: ${user}`)
})
  .on('message', async (messageId) => {
    const payload = await puppet.messagePayload(messageId)
    log.info('message', JSON.stringify(payload))
  })
  .on('error', err => {
    log.error('error', err)
  })
  .on('room-join', async (roomId, inviteeIdList, inviterId) => {
    log.info('room-join', 'roomId:%s, inviteeIdList=%s, inviterId=%s',
                          roomId,
                          JSON.stringify(inviteeIdList),
                          inviterId,
            )
  })
  .on('room-leave', async (roomId, leaverIdList) => {
    log.info('room-leave', 'roomId:%s, leaverIdList=%s',
                            roomId,
                            JSON.stringify(leaverIdList),
            )
  })
  .on('room-topic', async (roomId, newTopic, oldTopic, changerId) => {
    log.info('room-topic', 'roomId:%s, newTopic=%s, oldName=%s, changerId=%s',
                            roomId,
                            newTopic,
                            oldTopic,
                            changerId,
            )
  })

async function start () {
  await puppet.start()
  const contactIdList = await puppet.contactSearch({ name: '林贻民' })
  if (contactIdList.length) {
    // log.silly('发语音')
    // contact.say('hello')
  } else {
    log.silly('null')
  }

  const roomIdList = await puppet.roomSearch({ topic: '直播一群' })
  if (roomIdList.length) {
    log.silly('room 发消息')
    // room.say('hello')
  } else {
    log.silly('没有找到群')
  }

}

start().then(() => { return }).catch(() => { return })
