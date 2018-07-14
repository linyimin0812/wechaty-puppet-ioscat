import { FlashStoreSync } from 'flash-store'

import fs from 'fs-extra'

import path from 'path'
import os from 'os'

import {
  IosCatContactRawPayload,
  IosCatRoomMemberRawPayload,
  IosCatRoomRawPayload
} from './ioscat-schemas'

import {
  log,
  CONSTANT,
  ioscatToken
} from './config'

import { GroupApi, GroupMemberApi } from './api'

import { PuppetOptions } from 'wechaty-puppet'

export class IosCatManager {
  // persistent store
  private cacheContactRawPayload?: FlashStoreSync<string, IosCatContactRawPayload>
  private cacheRoomMemberRawPayload?: FlashStoreSync<string, {
    [contactId: string]: IosCatRoomMemberRawPayload,
  }>
  private cacheRoomRawPayload?: FlashStoreSync<string, IosCatRoomRawPayload>

  private GROUP_API = new GroupApi()
  private GROUP_MEMBER_API = new GroupMemberApi()

  constructor(
    public options: PuppetOptions = {},
  ) {
    
  }

  public async initCache(
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
    console.log('PuppetIoscat', 'initCache(%s, %s)', token, userId)
    

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
      console.log(err)
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

  public async releaseCache(): Promise<void> {
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


  public async syncRoomMember(
    roomId: string,
  ): Promise<{ [contactId: string]: IosCatRoomMemberRawPayload }> {
    log.silly('PuppetIosCatManager', 'syncRoomMember(%s)', roomId)

    // get memberIdList from infrastructure API with roomId
    let response = await this.GROUP_MEMBER_API.imGroupListMemberGet(CONSTANT.serviceID, roomId, CONSTANT.NAN,
      CONSTANT.NAN, CONSTANT.NAN, CONSTANT.LIMIT)
    let members = response.body.data
    // if the room is not exist, the members.content will be []
    if (!members || members.content.length <= 0) {
      this.roomMemberRawPayloadDirty(roomId)
      this.roomRawPayloadDirty(roomId)
      return {}
    }
    const memberDict: { [contactId: string]: IosCatRoomMemberRawPayload } = {}

    for (let member of members.content) {
      memberDict[member.platformUid] = member
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

  public async syncContactsAndRooms(): Promise<void> {
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

      let response = await this.GROUP_API.imGroupListGroupGet(CONSTANT.serviceID, this.options.token || ioscatToken(),
        CONSTANT.NULL, CONSTANT.NAN, CONSTANT.NAN, CONSTANT.NAN, CONSTANT.LIMIT)
      const roomList = response.body.data.content
      // if not rooms exist, the result roomList will be []
      if (roomList && roomList.length) {
        for (const room of roomList) {
          const roomRawPayload:IosCatRoomRawPayload = room
          const roomId = roomRawPayload.platformGid
          this.cacheRoomRawPayload.set(roomId, roomRawPayload)
        }
      } else {
        throw new Error(`${this.options.token || ioscatToken()} has not room`)
      }

      /**
       * Contact
       */

      // TODO: there is somthing wrong with the infrastructure API to get all contacts
      // log.silly('PuppetIosCatManager', 'syncContactsAndRooms() updating Contact %s(%s)')
      // const contactPayload = {} as IosCatContactRawPayload
      // const contactId = contactPayload.platformUid
      // this.cacheContactRawPayload.set(contactId, contactPayload)
    } else {
      throw new Error('id is neither room nor contact')
    }
  }

  public contactRawPayloadDirty(
    contactId: string,
  ): void {
    log.verbose('PuppetIosCatManager', 'contactRawPayloadDirty(%d)', contactId)
    if (!this.cacheContactRawPayload) {
      throw new Error('cache not inited')
    }
    this.cacheContactRawPayload.delete(contactId)
  }

  public roomMemberRawPayloadDirty(
    roomId: string,
  ): void {
    log.verbose('PuppetIosCatManager', 'roomMemberRawPayloadDirty(%d)', roomId)
    if (!this.cacheRoomMemberRawPayload) {
      throw new Error('cache not inited')
    }
    this.cacheRoomMemberRawPayload.delete(roomId)
  }
  public roomRawPayloadDirty(
    roomId: string,
  ): void {
    log.verbose('PuppetIosCatManager', 'roomRawPayloadDirty(%d)', roomId)
    if (!this.cacheRoomRawPayload) {
      throw new Error('cache not inited')
    }
    this.cacheRoomRawPayload.delete(roomId)
  }


  public async roomRawPayload(id: string): Promise<IosCatRoomRawPayload> {
    log.verbose('PuppetIosCatManager', 'roomRawPayload(%s)', id)
    if (!this.cacheRoomRawPayload) {
      throw new Error('no cache')
    }

    if (this.cacheRoomRawPayload.has(id)) {
      return this.cacheRoomRawPayload.get(id)
    }

    // room is not exist in cache, get it from infrastructure API
    const response = await this.GROUP_API.imGroupRetrieveGroupGet(CONSTANT.NAN, CONSTANT.serviceID, id)
    const rawPayload: IosCatRoomRawPayload = response.body.data

    // get memberIdList from infrastructure API with roomId
    const listMemberResponse = await this.GROUP_MEMBER_API.imGroupListMemberGet(CONSTANT.serviceID, id, CONSTANT.NAN,
      CONSTANT.NAN, CONSTANT.NAN, CONSTANT.LIMIT)
    let members = listMemberResponse.body.data
    // if the room of id is not exist, the result will not involved data filed
    if (rawPayload || (members && members.content.length > 0)/* && tryRawPayload.user_name */) {
      let memberIdList = members.content.map((value, index) => {
        return value.platformUid
      })
      rawPayload.memberIdList = memberIdList
      log.verbose('PuppetIosCatManager', 'rawPayload: %s', rawPayload)
      this.cacheRoomRawPayload.set(id, rawPayload)
      return rawPayload
    }
    throw new Error('room of id is not exist')
  }
}