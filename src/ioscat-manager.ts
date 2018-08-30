import { FlashStoreSync } from 'flash-store'

import fs from 'fs-extra'

import os from 'os'
import path from 'path'

import {
  IosCatContactRawPayload,
  IosCatRoomMemberRawPayload,
  IosCatRoomRawPayload,
} from './ioscat-schemas'

import {
  CONSTANT,
  ioscatToken,
  log,
} from './config'

import {
  ApiApi,
  ContactApi,
  GroupApi,
  GroupMemberApi,
  PBIMSendMessageReq,
  ProfileApi,
} from '../generated/api'

import { PuppetOptions, Receiver } from 'wechaty-puppet'

import { Watchdog } from 'watchdog'
import { IosCatEvent } from './pure-function-helper/ioscat-event'
export class IosCatManager {
  // persistent store
  private cacheContactRawPayload?: FlashStoreSync<string, IosCatContactRawPayload>
  private cacheRoomMemberRawPayload?: FlashStoreSync<string, {
    [contactId: string]: IosCatRoomMemberRawPayload,
  }>
  private cacheRoomRawPayload?: FlashStoreSync<string, IosCatRoomRawPayload>

  // FIXME: Use id not use platformUid, and Use gid not use platformGid
  private contactIdMap: Map<string, string> = new Map<string, string>()
  private roomIdMap: Map<string, string> = new Map<string, string>()

  /**
   * swagger generator api
   */
  private API                       = new ApiApi()
  private GROUP_API                 = new GroupApi()
  private GROUP_MEMBER_API          = new GroupMemberApi()
  private CONTACT_API: ContactApi   = new ContactApi()
  private PROFILE_API: ProfileApi   = new ProfileApi()
  public dog: Watchdog
  public timer: NodeJS.Timer | undefined        // `undefined` stands for the initail value
  constructor (
    public options: PuppetOptions = {},
    timeout: number = 60 * 1000
  ) {
    this.dog = new Watchdog(timeout)
  }

  public async initCache (
    token: string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'initCache(%s)', token)

    if (this.cacheContactRawPayload
      || this.cacheRoomMemberRawPayload
      || this.cacheRoomRawPayload
    ) {
      throw new Error('cache exists')
    }

    const baseDir = path.join(
      os.homedir(),
      path.sep,
      '.wechaty',
      'puppet-ioscat-cache',
      path.sep,
      token,
    )

    const baseDirExist = await fs.pathExists(baseDir)

    if (!baseDirExist) {
      await fs.mkdirp(baseDir)
    }
    log.silly('PuppetIoscat', 'initCache(%s)', token)

    try {
      this.cacheContactRawPayload = new FlashStoreSync(path.join(baseDir, 'contact-raw-payload'))
      this.cacheRoomMemberRawPayload = new FlashStoreSync(path.join(baseDir, 'room-member-raw-payload'))
      this.cacheRoomRawPayload = new FlashStoreSync(path.join(baseDir, 'room-raw-payload'))

      await Promise.all([
        this.cacheContactRawPayload.ready(),
        this.cacheRoomMemberRawPayload.ready(),
        this.cacheRoomRawPayload.ready(),
      ])
    } catch (err) {
      log.error(err)
    }

    if (! this.cacheRoomMemberRawPayload || !this.cacheContactRawPayload
    || !this.cacheRoomRawPayload) {
      throw new Error('cache not exist')
    }
    const roomMemberTotalNum = [...this.cacheRoomMemberRawPayload.values()].reduce(
      (accuVal, currVal) => {
        return accuVal + Object.keys(currVal).length
      },
      0,
    )

    log.verbose('PuppetIosCatManager', 'initCache() inited %d Contacts, %d RoomMembers, %d Rooms, cachedir="%s"',
      this.cacheContactRawPayload.size,
      roomMemberTotalNum,
      this.cacheRoomRawPayload.size,
      baseDir,
    )
  }

  public async releaseCache (): Promise<void> {
    log.verbose('PuppetIosCatManager', 'releaseCache()')

    if (this.cacheContactRawPayload
      && this.cacheRoomMemberRawPayload
      && this.cacheRoomRawPayload
    ) {
      log.silly('PuppetIosCatManager', 'releaseCache() closing caches ...')

      await Promise.all([
        this.cacheContactRawPayload.close(),
        this.cacheRoomMemberRawPayload.close(),
        this.cacheRoomRawPayload.close(),
      ])

      this.cacheContactRawPayload = undefined
      this.cacheRoomMemberRawPayload = undefined
      this.cacheRoomRawPayload = undefined

      log.silly('PuppetIosCaManager', 'releaseCache() cache closed.')
    } else {
      log.verbose('PuppetIosCatManager', 'releaseCache() cache not exist.')
    }
  }

  /**
   * room member
   */

  public async syncRoomMember (
    roomId: string,
  ): Promise<{ [contactId: string]: IosCatRoomMemberRawPayload }> {
    log.silly('PuppetIosCatManager', 'syncRoomMember(%s)', roomId)

    // get memberIdList from infrastructure API with roomId
    const response = await this.GROUP_MEMBER_API.imGroupMemberListGet(CONSTANT.serviceID, roomId, CONSTANT.NAN,
      CONSTANT.NAN, CONSTANT.NAN, CONSTANT.LIMIT)
    const members = response.body.data
    // if the room is not exist, the members.content will be []
    if (!members || members.content.length <= 0) {
      this.roomMemberRawPayloadDirty(roomId)
      this.roomRawPayloadDirty(roomId)
      return {}
    }
    const memberDict: { [contactId: string]: IosCatRoomMemberRawPayload } = {}

    for (const member of members.content) {
      // FIXME: should not use `as any`
      memberDict[member.platformUid] = member as any
    }

    log.silly('PuppetIosCatManager', 'syncRoomMember(%s) total %d members',
      roomId,
      Object.keys(memberDict).length,
    )

    if (!this.cacheRoomMemberRawPayload) {
      throw new Error('cache not inited')
    }

    const oldMemberDict = this.cacheRoomMemberRawPayload.get(roomId)
    const newMemberDict = {
      ...oldMemberDict,
      ...memberDict,
    }
    this.cacheRoomMemberRawPayload.set(roomId, newMemberDict)
    return newMemberDict
  }

  /**
   * Contact and Room
   */

  public async syncContactsAndRooms (): Promise<void> {
    log.verbose('PuppetIosCatManager', `syncContactsAndRooms()`)

    if (!this.cacheContactRawPayload
      || !this.cacheRoomRawPayload
    ) {
      throw new Error('no cache')
    }

    const platformUid = this.options.token || ioscatToken()
    // if the user is logined
    if (platformUid) {
      log.silly('PuppetIosCatmanager', 'syncContactAndRooms()')

      /**
       * room
       */
      try {
        const response = await this.GROUP_API.imGroupListGet(
          CONSTANT.serviceID,
          platformUid,
          CONSTANT.NULL,
          CONSTANT.NAN,
          CONSTANT.NAN,
          CONSTANT.NAN,
          CONSTANT.LIMIT,
        )
        const roomList = response.body.data.content
        log.silly('PuppetIosCatManager', `syncRooms(), length %s`, roomList.length)
        // if not rooms exist, the result roomList will be []
        if (roomList && roomList.length) {
          for (const room of roomList) {
            // FIXME: should not use `as any`
            const roomRawPayload: IosCatRoomRawPayload = room as any
            const roomId = roomRawPayload.platformGid
            if (!roomId) {
              continue
            }
            this.cacheRoomRawPayload.set(roomId, roomRawPayload)
            await this.roomMemberRawpayload(room.platformGid)
            this.roomIdMap.set(roomId, roomRawPayload.id)
          }
        } else {
          throw new Error(`${platformUid} has not room`)
        }
      } catch (err) {
        log.error('PuppetIoscatManager', 'syncRooms failed, %s ', JSON.stringify(err))
      }

      /**
       * Contact
       */
      const body = (await this.PROFILE_API.imProfileContactsGet(CONSTANT.serviceID, platformUid)).body
      if (body.code === 0) {
        for (const contact of body.data) {
          this.cacheContactRawPayload.set(contact.platformUid, contact as any)
          this.contactIdMap.set(contact.platformUid, contact.id + '')
        }
      }
      log.silly('PuppetIosCatManager', 'syncContactsAndRooms() syncing Contact(%d) & Room(%d) ...',
          this.cacheContactRawPayload.size,
          this.cacheRoomRawPayload.size,
        )
      log.verbose('PuppetIosCatManager', 'syncContactsAndRooms() sync contact done!')

    } else {
      throw new Error('id is neither room nor contact')
    }
  }

  public contactRawPayloadDirty (
    contactId: string,
  ): void {
    log.verbose('PuppetIosCatManager', 'contactRawPayloadDirty(%d)', contactId)
    if (!this.cacheContactRawPayload) {
      throw new Error('cache not inited')
    }
    this.cacheContactRawPayload.delete(contactId)
  }

  public roomMemberRawPayloadDirty (
    roomId: string,
  ): void {
    log.verbose('PuppetIosCatManager', 'roomMemberRawPayloadDirty(%s)', roomId)
    if (!this.cacheRoomMemberRawPayload) {
      throw new Error('cache not inited')
    }
    this.cacheRoomMemberRawPayload.delete(roomId)
  }

  public roomRawPayloadDirty (
    roomId: string,
  ): void {
    log.verbose('PuppetIosCatManager', 'roomRawPayloadDirty(%d)', roomId)
    if (!this.cacheRoomRawPayload) {
      throw new Error('cache not inited')
    }
    this.cacheRoomRawPayload.delete(roomId)
  }

  public async roomRawPayload (id: string): Promise<IosCatRoomRawPayload> {
    log.verbose('PuppetIosCatManager', 'roomRawPayload(%s)', id)
    if (!this.cacheRoomRawPayload) {
      throw new Error('no cache')
    }

    if (this.cacheRoomRawPayload.has(id)) {
      const roomRawPayload = this.cacheRoomRawPayload.get(id)
      if (roomRawPayload) {
        return roomRawPayload
      }
    }

    // room is not exist in cache, get it from infrastructure API
    const body = (await this.GROUP_MEMBER_API.imGroupMemberListGet(CONSTANT.serviceID, id)).body
    if (body.code === 0 && body.data && body.data.content.length > 0) {
      const gid = body.data.content[0].gid + ''
      const response = await this.GROUP_API.imGroupRetrieveGet(gid)
      // FIXME: should not use `as any`
      const rawPayload: IosCatRoomRawPayload = response.body.data as any
      // get memberIdList from infrastructure API with roomId
      const listMemberResponse = await this.GROUP_MEMBER_API.imGroupMemberListGet(CONSTANT.serviceID, id, CONSTANT.NAN,
        CONSTANT.NAN, CONSTANT.NAN, CONSTANT.LIMIT)
      const members = listMemberResponse.body.data
      // if the room of id is not exist, the result will not involved data filed
      if (rawPayload && (members && members.content.length > 0)) {
        const memberIdList = await members.content.map((value: any, index: any) => {
          return value.platformUid
        })
        rawPayload.memberIdList = memberIdList
        log.verbose('PuppetIosCatManager', 'rawPayload: %s', JSON.stringify(rawPayload, null, 2))
        this.cacheRoomRawPayload.set(id, rawPayload)
        return rawPayload
      } else {
        throw new Error(`room of id = ${id} is not exist`)
      }
    } else {
      throw new Error(`room of id = ${id} is not exist`)
    }
  }

  public async roomMemberRawpayload (roomId: string): Promise<{ [contactId: string]: IosCatRoomMemberRawPayload }> {
    log.verbose('PuppetIosCatManager', 'roomMemberRawPayload(%s)', roomId)
    if (!this.cacheRoomMemberRawPayload) {
      throw new Error('cache not init')
    }
    if (this.cacheRoomMemberRawPayload.has(roomId)) {
      const roomMemberPayload = this.cacheRoomMemberRawPayload.get(roomId)
      if (! roomMemberPayload) {
        throw new Error('room id not exists')
      }
      return roomMemberPayload
    }
    const response = await this.GROUP_MEMBER_API.imGroupMemberListGet(CONSTANT.serviceID, roomId,
    CONSTANT.NAN, CONSTANT.NAN, CONSTANT.NAN, CONSTANT.LIMIT)
    if (response.body.code === 0 && response.body.data) {
      // FIXME: should not use `as any`
      const roomMembers = response.body.data.content
      const membersPayloads: {[key: string]: IosCatRoomMemberRawPayload} = {} as any
      for (const member of roomMembers) {
        membersPayloads[member.platformUid] = member
      }
      this.cacheRoomMemberRawPayload.set(roomId, membersPayloads)
      return membersPayloads
    }
    throw new Error('contact not exist')
  }

  public async contactRawPayload (contactId: string): Promise<IosCatContactRawPayload> {
    if (!this.cacheContactRawPayload) {
      throw new Error('cache not init')
    }
    if (this.cacheContactRawPayload.has(contactId)) {
      const contactPayload = this.cacheContactRawPayload.get(contactId)
      if (! contactPayload) {
        throw new Error('contact id not exists')
      }
      return contactPayload
    }
    const platformUid = this.options.token || ioscatToken()
    if (contactId === platformUid) {
      const body = (await this.API.imApiProfileInfoGet(CONSTANT.serviceID, platformUid)).body
      if (body.code === 0 && body.data) {
        const result: IosCatContactRawPayload = {
          avatar      : body.data.avatar,
          city        : body.data.city,
          country     : body.data.country,
          ctime       : body.data.ctime,
          customID    : body.data.customID,
          extra       : body.data.extra,
          gender      : body.data.gender,
          id          : body.data.id + '',
          nickname    : body.data.nickname,
          platformUid : body.data.platformUid,
          serviceID   : body.data.serviceID,
          signature   : body.data.signature,
          state       : body.data.state,
          tags        : [body.data.tags],
        }
        return result
      } else {
        throw new Error(`contact = ${contactId} not exist`)
      }
    } else {
      const id = this.contactIdMap.get(contactId)
      // FIXME: Use id ,not use platformUid
      const response = await this.CONTACT_API.imContactRetrieveGet(id)
      if (response.body.code === 0 && response.body.data) {
        // FIXME: should not use `as any`
        const rawPayload: IosCatContactRawPayload = response.body.data as any
        this.cacheContactRawPayload.set(contactId, rawPayload)
        return rawPayload
      }
      log.error('contactRawPayload', 'length = %d', this.contactIdMap.size)
      throw new Error(`contact = ${id} not exist`)
    }
  }

  public getContactList (): string[] {
    log.verbose('IosCatManager', 'getContactList()')
    if (!this.cacheContactRawPayload) {
      throw new Error('cache not init')
    }
    const contactIdList = [...this.cacheContactRawPayload.keys()]
    log.silly('IosCatManager', 'getContactIdList() = %d', contactIdList.length)
    return contactIdList
  }

  public getRoomIdList (): string[] {
    log.verbose('PuppetiosCatManager', 'getRoomIdList()')
    if (!this.cacheRoomRawPayload) {
      throw new Error('cache not inited')
    }
    const roomIdList = [...this.cacheRoomRawPayload.keys()]
    log.verbose('PuppetiosCatManager', 'getRoomIdList()=%d', roomIdList.length)
    return roomIdList
  }

  public async getRoomMemberIdList (
    roomId: string,
    dirty = false,
  ): Promise<string[]> {
    log.verbose('PuppetIoscatManager', 'getRoomMemberIdList(%s)', roomId)
    if (!this.cacheRoomMemberRawPayload) {
      throw new Error('cache not inited')
    }

    if (dirty) {
      this.roomMemberRawPayloadDirty(roomId)
    }

    const memberRawPayloadDict = this.cacheRoomMemberRawPayload.get(roomId)
      || await this.syncRoomMember(roomId)

    if (!memberRawPayloadDict) {
      // or return [] ?
      throw new Error('roomId not found: ' + roomId)
    }

    const memberIdList = Object.keys(memberRawPayloadDict)

    // console.log('memberRawPayloadDict:', memberRawPayloadDict)
    log.verbose('PuppetIoscatManager', 'getRoomMemberIdList(%s) length=%d', roomId, memberIdList.length)
    return memberIdList
  }

  public async sendMessage (
    receiver: Receiver,
    message: string,
    messageType?: number,
    atMembers?: string[],
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'sendMessage(%s, %s)', receiver, message)
    if (! this.cacheRoomMemberRawPayload) {
      throw new Error('cache no init')
    }
    const data: PBIMSendMessageReq = new PBIMSendMessageReq()
    data.serviceID = CONSTANT.serviceID
    data.fromCustomID = this.options.token || ioscatToken() // WECHATY_PUPPET_IOSCAT_TOKEN
    data.content = message
    if (messageType) {
      data.type = messageType
    }
    if (receiver.roomId) {
      // 1. 群聊 first
      data.sessionType = CONSTANT.G2G
      data.toCustomID = receiver.roomId
      // Notice: The member in the room whose alias may not exist,
      // if that, we use the contact's nickname
      if (atMembers) {
        let atMemberName = ''
        for (const memberId of atMembers) {
          const memberPayload = await this.roomMemberRawpayload(receiver.roomId)
          if (!memberPayload) {
            throw new Error('Room of roomId is no exist')
          }
          const memberInfo = memberPayload[memberId]
          if (memberInfo && memberInfo.alias) {
            atMemberName = '@' + memberInfo.alias + ' '
          } else {
            const contactPayload = await this.contactRawPayload(memberId)
            if (!contactPayload) {
              throw new Error('The contact of id no exist')
            }
            atMemberName = '@' + contactPayload.nickname + ' '
          }
        }
        data.content = atMemberName + data.content
      }
    } else if (receiver.contactId) {
      // 2. 私聊 second
      data.toCustomID = receiver.contactId
      data.sessionType = CONSTANT.P2P
    } else {
      throw new Error('接收人名称不能为空')
    }
    this.API.imApiSendMessagePost(data)
  }

  public async checkOnline () {
    log.silly('IoscatMnager', 'checkOnline()')
    this.dog.on('feed', (food) => {
      IosCatEvent.emit('heartbeat', food.data)
      log.silly('checkOnline()', 'feed')
    })

    this.dog.on('reset', () => {
      // something wrong
      IosCatEvent.emit('broken')
    })
    // send a message periodic

    const data: PBIMSendMessageReq = new PBIMSendMessageReq()
    data.serviceID = CONSTANT.serviceID,
    data.sessionType = CONSTANT.P2P
    data.toCustomID = data.fromCustomID = this.options.token || ioscatToken()
    data.content = CONSTANT.MESSAGE
    this.API.imApiSendMessagePost(data)
    this.timer = setInterval(async () => {
      await this.API.imApiSendMessagePost(data)
    }, 20 * 1000)
  }
}
