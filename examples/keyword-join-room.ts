import {
  Contact,
  Message,
  Room,
  Wechaty,
} from 'wechaty'
import { ContactSelf } from 'wechaty/dist/src/user'
import { PuppetIoscat } from '../src/'
import { log } from '../src/config'

const puppet = new PuppetIoscat({
  token: 'wxid_tdax1huk5hgs12',
})
const bot = new Wechaty({
  puppet,
})
bot.on('login', async (user: ContactSelf) => {
  log.silly(`login: ${user}`)
})
  .on('message', async (message: Message) => {
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
  .on('error', (err: Error) => {
    log.error('error', err)
  })
  .on('room-join', async (roomId: Room, inviteeIdList: Contact[], inviterId: Contact) => {
    log.info('room-join', 'roomId:%s, inviteeIdList=%s, inviterId=%s',
                          roomId,
                          JSON.stringify(inviteeIdList),
                          inviterId,
            )
  })

bot.start()
