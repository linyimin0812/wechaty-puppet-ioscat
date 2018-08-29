import { PuppetIoscat } from '../src/'
import { log } from '../src/config'

const puppet = new PuppetIoscat({
  token: 'wxid_tdax1huk5hgs12',
})
puppet.on('login', async (userId: string) => {
  log.silly(`login: ${userId}`)
})
  .on('message', async (messageId: string) => {
    const messagePayload = await puppet.messagePayload(messageId)
    const selfId = puppet.selfId()
    const fromId = messagePayload.fromId
    if (selfId !== fromId && fromId) {
      const content = messagePayload.text
      if (content === '入群') {
        const roomIdList = await puppet.roomSearch({ topic: '直播一群' })
        if (roomIdList.length) {
          await puppet.roomAdd(roomIdList[0], fromId)
        }
      }
    }
  })
  .on('error', (err: string) => {
    log.error('error', err)
  })
  .on('room-join', async (roomId: string, inviteeIdList: string[], inviterId: string) => {
    log.info('room-join', 'roomId:%s, inviteeIdList=%s, inviterId=%s',
                          roomId,
                          JSON.stringify(inviteeIdList),
                          inviterId,
            )
  })

puppet.start()
.catch(e => log.error('Puppet', 'start rejectino: %s', e))
