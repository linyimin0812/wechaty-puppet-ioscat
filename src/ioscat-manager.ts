import { FlashStoreSync } from 'flash-store'

import fs from 'fs-extra'

import os from 'os'
import path from 'path'

import {
  IosCatContactRawPayload,
  IosCatRoomMemberRawPayload,
  IosCatRoomRawPayload
} from './ioscat-schemas'

import {
  CONSTANT,
  ioscatToken,
  log,
  STATUS
} from './config'

import {
  ContactApi,
  GroupApi,
  GroupMemberApi,
  RelationApi,
} from '../generated/api'

import { PuppetOptions } from 'wechaty-puppet'

export class IosCatManager {
  // persistent store
  private cacheContactRawPayload?: FlashStoreSync<string, IosCatContactRawPayload>
  private cacheRoomMemberRawPayload?: FlashStoreSync<string, {
    [contactId: string]: IosCatRoomMemberRawPayload,
  }>
  private cacheRoomRawPayload?: FlashStoreSync<string, IosCatRoomRawPayload>

  /**
   * swagger generator api
   */
  private GROUP_API                 = new GroupApi()
  private GROUP_MEMBER_API          = new GroupMemberApi()
  private RELATION_API: RelationApi = new RelationApi()
  private CONTACT_API: ContactApi   = new ContactApi()

  constructor (
    public options: PuppetOptions = {},
  ) {

  }

  public async initCache (
    token: string,
    userId: string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'initCache(%s, %s)', token, userId)

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
      path.sep,
      userId,
    )

    const baseDirExist = await fs.pathExists(baseDir)

    if (!baseDirExist) {
      await fs.mkdirp(baseDir)
    }
    log.silly('PuppetIoscat', 'initCache(%s, %s)', token, userId)

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
    const response = await this.GROUP_MEMBER_API.imGroupListMemberGet(CONSTANT.serviceID, roomId, CONSTANT.NAN,
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

    // if the user is logined
    if (this.options.token || ioscatToken()) {
      log.silly('PuppetIosCatmanager', 'ayncContactAndRooms()')

      /**
       * room
       */

      const response = await this.GROUP_API.imGroupListGroupGet(CONSTANT.serviceID, this.options.token || ioscatToken(),
        CONSTANT.NULL, CONSTANT.NAN, CONSTANT.NAN, CONSTANT.NAN, CONSTANT.LIMIT)
      const roomList = response.body.data.content
      log.silly('PuppetIosCatManager', `syncContactsAndRooms(), length %s`, this.options.token)
      // if not rooms exist, the result roomList will be []
      if (roomList && roomList.length) {
        for (const room of roomList) {
          // FIXME: should not use `as any`
          const roomRawPayload: IosCatRoomRawPayload = room as any
          const roomId = roomRawPayload.platformGid
          this.cacheRoomRawPayload.set(roomId, roomRawPayload)
          await this.roomMemberRawpayload(room.platformGid)
        }
      } else {
        throw new Error(`${this.options.token || ioscatToken()} has not room`)
      }

      /**
       * Contact
       */
      let page = 1
      const platformUid = this.options.token || ioscatToken()
      const platformUids = new Array<string>()
      while (true) {
        const relationPageBody = (await this.RELATION_API.imRelationPageGet(CONSTANT.serviceID,
          platformUid, CONSTANT.NULL, STATUS.FRIENDS_ACCEPTED, CONSTANT.NAN, page, CONSTANT.LIMIT, CONSTANT.NAN)).body
        if (relationPageBody.code === 0) {
          // when content is [], it means all contacts have got
          if (relationPageBody.data.content.length === 0) {
            break
          }
          for (const contact of relationPageBody.data.content) {
            platformUids.push(contact.platformUid)
          }
          // get next page contacts's id
          page += 1
        } else {
          break
        }
      }
      // use IDs to get all contacts's detail infomation
      try {
        const results = await Promise.all(
          platformUids.map(
            value => this.CONTACT_API.imContactRetrieveByPlatformUidGet(CONSTANT.serviceID, value),
          ),
        )
        for (const result of results) {
          const body = result.body
          if (body.code === 0) {
            // FIXME: should not use `as any`
            this.cacheContactRawPayload.set(body.data.platformUid, body.data as any)
            log.verbose('PuppetIosCatManager', 'syncContactsAndRooms() sync contact done!')
          } else {
            throw new Error(`There is wrong with base API: ${body.msg}`)
          }
        }
        log.silly('PuppetIosCatManager', 'syncContactsAndRooms() syncing Contact(%d) & Room(%d) ...',
            this.cacheContactRawPayload.size,
            this.cacheRoomRawPayload.size,
          )
      } catch (err) {
        log.error(err)
      }

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
    log.verbose('PuppetIosCatManager', 'roomMemberRawPayloadDirty(%d)', roomId)
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
      if (! roomRawPayload) {
        throw new Error('room id not exist')
      }
      return roomRawPayload
    }

    // room is not exist in cache, get it from infrastructure API
    const response = await this.GROUP_API.imGroupRetrieveGroupGet(CONSTANT.NAN, CONSTANT.serviceID, id)
    // FIXME: should not use `as any`
    const rawPayload: IosCatRoomRawPayload = response.body.data as any

    // get memberIdList from infrastructure API with roomId
    const listMemberResponse = await this.GROUP_MEMBER_API.imGroupListMemberGet(CONSTANT.serviceID, id, CONSTANT.NAN,
      CONSTANT.NAN, CONSTANT.NAN, CONSTANT.LIMIT)
    const members = listMemberResponse.body.data
    // if the room of id is not exist, the result will not involved data filed
    if (rawPayload || (members && members.content.length > 0)/* && tryRawPayload.user_name */) {
      const memberIdList = members.content.map((value, index) => {
        return value.platformUid
      })
      rawPayload.memberIdList = memberIdList
      log.verbose('PuppetIosCatManager', 'rawPayload: %s', JSON.stringify(rawPayload, null, 2))
      this.cacheRoomRawPayload.set(id, rawPayload)
      return rawPayload
    }
    throw new Error('room of id is not exist')
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
    const response = await this.GROUP_MEMBER_API.imGroupListMemberGet(CONSTANT.serviceID, roomId,
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
    const response = await this.CONTACT_API.imContactRetrieveByPlatformUidGet(CONSTANT.serviceID, contactId)
    if (response.body.code === 0 && response.body.data) {
      // FIXME: should not use `as any`
      const rawPayload: IosCatContactRawPayload = response.body.data as any
      this.cacheContactRawPayload.set(contactId, rawPayload)
      return rawPayload
    }
    throw new Error('contact not exist')
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
    log.verbose('PuppetIoscatManager', 'getRoomMemberIdList(%d)', roomId)
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
    log.verbose('PuppetIoscatManager', 'getRoomMemberIdList(%d) length=%d', roomId, memberIdList.length)
    return memberIdList
  }
}
