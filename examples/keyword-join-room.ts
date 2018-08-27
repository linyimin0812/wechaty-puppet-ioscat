import { Wechaty } from 'wechaty'
import { PuppetIoscat } from '../src/'
import { log } from '../src/config'

const puppet = new PuppetIoscat({
  token: 'wxid_tdax1huk5hgs12',
})
const bot = new Wechaty({
  puppet,
})
bot.on('login', async (user) => {
  log.silly(`login: ${user}`)
})
  .on('message', async (message) => {
    const from = message.from()
    if (! message.self() && from) {
      const content = message.content()
      if (content === '入群') {
        const room = await bot.Room.find('直播一群')
        if (room) {
          room.add(from)
        }
      }
    }
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

bot.start()
