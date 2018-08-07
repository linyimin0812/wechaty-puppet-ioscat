/**
 *   Wechaty - https://github.com/chatie/wechaty
 *
 *   @copyright 2016-2018 Huan LI <zixia@zixia.net>
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */
import LRU from 'lru-cache'

import {
  FileBox,
} from 'file-box'

import {
  ContactGender,
  ContactPayload,
  ContactType,

  FriendshipPayload,

  MessagePayload,

  Puppet,
  PuppetOptions,

  Receiver,

  RoomMemberPayload,
  RoomPayload,
} from 'wechaty-puppet'

import {
  IosCatContactRawPayload,
  IoscatMessageRawPayload,
  IosCatMessageType,
  IosCatRoomMemberRawPayload,
  IosCatRoomRawPayload,
} from './ioscat-schemas'

import {
  CONSTANT,
  ioscatToken,
  log,
  qrCodeForChatie
} from './config'

import { default as IMSink } from './im-sink'

import cuid from 'cuid'

import {
  ApiApi,
  PBIMAddGroupMembersReq,
  PBIMCreateGroupReq,
  PBIMDeleteGroupMembersReq,
  PBIMSendMessageReq,
  PBIMSetGroupDescReq,
  PBIMSetGroupNameReq,
} from '../generated/api'

import { IosCatManager } from './ioscat-manager'

import { IosCatEvent } from './pure-function-helper/ioscat-event'
import { messageRawPayloadParser } from './pure-function-helper/message-raw-parser'

import { roomJoinEventMessageParser } from './pure-function-helper/room-event-join-message-parser'
import { roomLeaveEventMessageParser } from './pure-function-helper/room-event-leave-message-parser'
import { roomTopicEventMessageParser } from './pure-function-helper/room-event-topic-message-parser'

import flatten from 'array-flatten'
export interface MockRoomRawPayload {
  topic: string,
  memberList: string[],
  ownerId: string,
}

export class PuppetIoscat extends Puppet {

  // ios API class instance
  private API: ApiApi = new ApiApi()

  // private loopTimer?: NodeJS.Timer
  private readonly cacheIoscatMessagePayload: LRU.Cache<string, IoscatMessageRawPayload>

  private iosCatManager: IosCatManager

  constructor (
    public options: PuppetOptions = {},
  ) {
    super(options)

    const lruOptions: LRU.Options = {
      max: 10000,
      // length: function (n) { return n * 2},
      dispose (key: string, val: any) {
        log.silly('PuppetIoscat', 'constructor() lruOptions.dispose(%s, %s)', key, JSON.stringify(val))
      },
      maxAge: 1000 * 60 * 60,
    }

    this.cacheIoscatMessagePayload = new LRU<string, any>(lruOptions)

    this.iosCatManager = new IosCatManager(options)

  }

  public async start (): Promise<void> {
    log.verbose('PuppetIoscat', `start()`)

    this.state.on('pending')

    // await some tasks...
    const topic = `im.topic.13.${this.options.token || ioscatToken()}`

    log.silly('topic: ', topic)
    await IMSink.start(topic)

    this.state.on(true)

    this.id = this.options.token || ioscatToken()

    this.startWatchdog()

    this.initEventHook()

    //  init cache
    await this.iosCatManager.initCache(this.id)

    // const user = this.Contact.load(this.id)
    // emit contactId
    // TODO: 验证
    this.emit('login', this.id)
    // FIXME: should do this after login
    // sync roomMember, contact and room
    this.iosCatManager.syncContactsAndRooms().then(() => { return }).catch(() => { return })
  }

  private initEventHook () {
    IMSink.event.on('MESSAGE', async (msg: IoscatMessageRawPayload) => {
      /**
       * 0. Discard messages when not loggedin
       */
      if (!this.id) {
        log.warn('PuppetIoscat', 'onPadchatMessage(%s) discarded message because puppet is not logged-in',
        JSON.stringify(msg))
        return
      }

      /**
       * 1. Save message for future usage
       */
      msg.id = cuid()
      this.cacheIoscatMessagePayload.set(msg.id, msg)

      /**
       * Check for Diffirent Message Types
       */
      if (msg.type === 'ON_IM_MESSAGE_RECEIVED') {
        this.emit('message', msg.id)

        // if the message is period message, feed the dog
        if (msg.payload.content === CONSTANT.MESSAGE) {
          this.iosCatManager.dog.feed({ data: 'work' })
        }
        switch (msg.payload.messageType) {
          case IosCatMessageType.Notify: {
            await Promise.all([
              this.onIosCatMessageRoomEventJoin(msg),
              this.onIoscatMessageRoomEventLeave(msg),
              this.onIoscatMessageRoomEventTopic(msg),
            ])
            break
          }
          case IosCatMessageType.Text:
          case IosCatMessageType.Video:
          case IosCatMessageType.Image:
          case IosCatMessageType.Link:
          default:
            // this.emit('message', msg.id)
            break
        }
        return
      }
      // 掉线信息
      if (msg.type === 'ON_DMS_HEARTBEAT_TIMEOUT') {
        // throw 一个error
        this.emit('error', new Error(msg.id))
        return
      }
      // 添加好友信息
      if (msg.type === 'ON_IM_RELATION_APPLY') {
        this.emit('friendship', msg.id)
        return
      }
    })
  }

  public startWatchdog (): void {
    log.verbose('PuppetIoscat', 'startWatchdog()')

    if (!this.iosCatManager) {
      throw new Error('no ioscat manager')
    }

    /**
     * Use ioscat-event heartbeat to feed dog
     */
    IosCatEvent.on('heartbeat', (data: string) => {
      log.silly('PuppetIoscat', 'startWatchdog() IosCatEvent.on(heartbeat)')
      this.emit('watchdog', {
        data,
      })
    })

    IosCatEvent.on('broken', () => {
      this.emit('error', new Error('Cant receive message event'))
    })

    this.emit('watchdog', {
      data: 'inited',
      type: 'startWatchdog()',
    })

    // send message `periodic_message`
    this.iosCatManager.checkOnline()
    .catch(() => { return })
  }
  public async stop (): Promise<void> {
    log.verbose('PuppetIoscat', 'stop()')

    if (this.state.off()) {
      log.warn('PuppetIoscat', 'stop() is called on a OFF puppet. await ready(off) and return.')
      await this.state.ready('off')
      return
    }

    this.state.off('pending')

    // await some taks...
    // 关闭监听消息事件
    await IMSink.close()

    // release cache
    await this.iosCatManager.releaseCache()

    this.state.off(true)
  }

  public async logout (): Promise<void> {
    log.verbose('PuppetIoscat', 'logout()')

    if (!this.id) {
      throw new Error('logout before login?')
    }

    this.emit('logout', this.id) // becore we will throw above by logonoff() when this.user===undefined
    this.id = undefined

    // do the logout job --> release cache
    await this.iosCatManager.releaseCache()
  }

  /**
   *
   * Contact
   *
   */
  public contactAlias (contactId: string): Promise<string>
  public contactAlias (contactId: string, alias: string | null): Promise<void>

  public async contactAlias (contactId: string, alias?: string | null): Promise<void | string> {
    log.verbose('PuppetIoscat', 'contactAlias(%s, %s)', contactId, alias)

    if (typeof alias === 'undefined') {
      const contact = await this.contactPayload(contactId)
      return contact.alias || ''
    }
    throw new Error('not supported')
  }

  // TODO: test
  public async contactList (): Promise<string[]> {
    log.verbose('PuppetIoscat', 'contactList()')
    if (!this.iosCatManager) {
      throw new Error('no ioscat manager')
    }
    const contactIDs = this.iosCatManager.getContactList()
    return contactIDs
  }

  public async contactQrcode (contactId: string): Promise<string> {
    throw new Error('not supported')
    // return await this.bridge.WXqr
  }

  public async contactAvatar (contactId: string): Promise<FileBox>
  public async contactAvatar (contactId: string, file: FileBox): Promise<void>

  public async contactAvatar (contactId: string, file?: FileBox): Promise<void | FileBox> {
    log.verbose('PuppetIoscat', 'contactAvatar(%s)', contactId)

    /**
     * 1. set
     */
    if (file) {
      throw new Error('not support')
    }

    /**
     * 2. get
     */
    const contact = await this.contactPayload(contactId)
    return FileBox.fromUrl(contact.avatar)
  }

  public async contactRawPayload (id: string): Promise<IosCatContactRawPayload> {
    log.verbose('PuppetIoscat', 'contactRawPayload(%s)', id)
    const rawPayload: IosCatContactRawPayload = await this.iosCatManager.contactRawPayload(id)
    log.verbose('PuppetIoscat', 'rawPayload=%s', JSON.stringify(rawPayload))
    return rawPayload
  }

  public async contactRawPayloadParser (rawPayload: IosCatContactRawPayload): Promise<ContactPayload> {
    log.verbose('PuppetIoscat', 'contactRawPayloadParser()')

    let gender = ContactGender.Unknown
    if (rawPayload.gender === 1) {
      gender = ContactGender.Male
    } else if (rawPayload.gender === 2) {
      gender = ContactGender.Female
    }
    let contactType = ContactType.Unknown
    if (rawPayload.type === 1) {
      contactType = ContactType.Personal
    } else if (rawPayload.type === 2) {
      contactType = ContactType.Official
    }
    const payload: ContactPayload = {
      avatar: rawPayload.avatar,
      city: rawPayload.city,
      gender,
      id: rawPayload.platformUid,
      name: rawPayload.nickname,
      province: rawPayload.state,
      signature: rawPayload.signature,
      type: contactType,
      weixin: rawPayload.customID
    }
    return payload
  }

  /**
   * Overwrite the Puppet.contactPayload()
   */
  public async contactPayload (
    contactId: string,
  ): Promise<ContactPayload> {

    try {
      const payload = await super.contactPayload(contactId)
      return payload
    } catch (e) {
      log.silly('PuppetIoscat', 'contactPayload(%s) exception: %s', contactId, e.message)
      log.silly('PuppetIoscat', 'contactPayload(%s) get failed for %s',
      'try load from room member data source', contactId)
    }

    const rawPayload = await this.contactRawPayload(contactId)

    /**
     * Issue #1397
     *  https://github.com/Chatie/wechaty/issues/1397#issuecomment-400962638
     *
     * Try to use the contact information from the room
     * when it is not available directly
     */
    if (!rawPayload || Object.keys(rawPayload).length <= 0) {
      log.silly('PuppetIoscat', 'contactPayload(%s) rawPayload not exist', contactId)

      const roomList = await this.contactRoomList(contactId)
      log.silly('PuppetIoscat', 'contactPayload(%s) found %d rooms', contactId, roomList.length)

      if (roomList.length > 0) {
        const roomId = roomList[0]
        const roomMemberPayload = await this.roomMemberPayload(roomId, contactId)
        if (roomMemberPayload) {

          const payload: ContactPayload = {
            avatar : roomMemberPayload.avatar,
            gender : ContactGender.Unknown,
            id     : roomMemberPayload.id,
            name   : roomMemberPayload.name,
            type   : ContactType.Personal,
          }

          this.cacheContactPayload.set(contactId, payload)
          log.silly('PuppetIoscat', 'contactPayload(%s) cache SET', contactId)

          return payload
        }
      }
      throw new Error('no raw payload')
    }

    return this.contactRawPayloadParser(rawPayload)
  }

  /**
   *
   * Message
   *
   */
  // TODO:
  public async messageFile (id: string): Promise<FileBox> {
    return FileBox.fromBase64(
      'cRH9qeL3XyVnaXJkppBuH20tf5JlcG9uFX1lL2IvdHRRRS9kMMQxOPLKNYIzQQ==',
      'mock-file' + id + '.txt',
    )
  }

  public async messageRawPayload (id: string): Promise<IoscatMessageRawPayload> {
    log.verbose('PuppetIoscat', 'messageRawPayload(%s)', id)
    const rawPayload = this.cacheIoscatMessagePayload.get(id)
    if (rawPayload) {
      return rawPayload
    }
    throw new Error('message not exist')
  }

  public async messageRawPayloadParser (rawPayload: IoscatMessageRawPayload): Promise<MessagePayload> {
    log.verbose('PuppetIoscat', 'messagePayload(%s)', JSON.stringify(rawPayload, null, 2))
    const payload = messageRawPayloadParser(rawPayload)
    return payload
  }

  public async messageSendText (
    receiver: Receiver,
    text: string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'messageSend(%s, %s)', receiver, text)
    const data: PBIMSendMessageReq = new PBIMSendMessageReq()
    data.serviceID = CONSTANT.serviceID
    data.fromCustomID = this.options.token || ioscatToken() // WECHATY_PUPPET_IOSCAT_TOKEN
    data.content = text
    // 私聊
    if (receiver.contactId) {
      data.toCustomID = receiver.contactId
      data.sessionType = CONSTANT.P2P
    } else if (receiver.roomId) {
      // 群聊
      data.sessionType = CONSTANT.G2G
      data.toCustomID = receiver.roomId

    } else {
      throw new Error('接收人名称不能为空')
    }
    this.API.imApiSendMessagePost(data)

  }

  // TODO:
  public async messageSendFile (
    receiver: Receiver,
    file: FileBox,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'messageSend(%s, %s)', receiver, file)
  }

  // TODO:
  public async messageSendContact (
    receiver: Receiver,
    contactId: string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'messageSend("%s", %s)', JSON.stringify(receiver), contactId)
    return
  }

  // TODO:
  public async messageForward (
    receiver: Receiver,
    messageId: string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'messageForward(%s, %s)',
      receiver,
      messageId,
    )
  }

  /**
   *
   * Room
   *
   */
  public async roomRawPayload (
    id: string,
  ): Promise<IosCatRoomRawPayload> {
    log.verbose('PuppetIoscat', 'roomRawPayload(%s)', id)

    if (!this.iosCatManager) {
      throw new Error('no ioscat manager')
    }
    const rawPayload = await this.iosCatManager.roomRawPayload(id)
    return rawPayload
  }

  public async roomRawPayloadParser (
    rawPayload: IosCatRoomRawPayload,
  ): Promise<RoomPayload> {
    log.verbose('PuppetIoscat', 'roomRawPayloadParser(%s)', JSON.stringify(rawPayload, null, 2))

    // FIXME: should not use any
    const payload = {
      avatar: rawPayload.avatar,
      id: rawPayload.platformGid,
      memberIdList: rawPayload.memberIdList,
      ownerId: rawPayload.ownerPlatformUid,
      topic: rawPayload.name,
    }
    return payload as any
  }

  public async roomList (): Promise<string[]> {
    log.verbose('PuppetIoscat', 'roomList()')
    const rooms = this.iosCatManager.getRoomIdList()
    return rooms
  }

  // TODO: test
  public async roomDel (
    roomId: string,
    contactId: string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'roomDel(%s, %s)', roomId, contactId)
    const requestBody: PBIMDeleteGroupMembersReq = {
      customID: this.options.token || ioscatToken(),
      memberCustomIDs: [
        contactId
      ],
      platformGid: roomId,
      serviceID: CONSTANT.serviceID,
    }

    const body = (await this.API.imApiDeleteGroupMembersPost(requestBody)).body
    if (body.code === 0) {
      await Promise.all([
        this.roomMemberPayloadDirty(roomId),
        this.roomPayloadDirty(roomId)
      ])
      log.info('PuppetIosCat', 'roomDel success')
    } else {
      log.info('PuppetIosCat', 'roomDel failed')
    }
  }

  public async roomAvatar (roomId: string): Promise<FileBox> {
    log.verbose('PuppetIoscat', 'roomAvatar(%s)', roomId)

    const payload = await this.roomPayload(roomId)

    if (payload.avatar) {
      return FileBox.fromUrl(payload.avatar)
    }
    log.warn('PuppetIoscat', 'roomAvatar() avatar not found, use the chatie default.')
    return qrCodeForChatie()
  }

  // TODO: test
  public async roomAdd (
    roomId: string,
    contactId: string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'roomAdd(%s, %s)', roomId, contactId)
    const requestBody: PBIMAddGroupMembersReq = {
      customID: this.options.token || ioscatToken(),
      memberCustomIDs: [
        contactId
      ],
      platformGid: roomId,
      serviceID: CONSTANT.serviceID
    }
    const body = (await this.API.imApiAddGroupMembersPost(requestBody)).body
    if (body.code === 0) {
      log.info('PuppetIosCat', 'roomAdd success')
    } else {
      log.info('PuppetIosCat', 'roomAdd failed')
    }
  }

  public async roomTopic (roomId: string): Promise<string>
  public async roomTopic (roomId: string, topic: string): Promise<void>
  // TODO: test
  public async roomTopic (
    roomId: string,
    topic?: string,
  ): Promise<void | string> {
    log.verbose('PuppetIoscat', 'roomTopic(%s, %s)', roomId, topic)

    // return the current room topic
    if (typeof topic === 'undefined') {
      const payload = await this.iosCatManager.roomRawPayload(roomId)
      return payload.name
    }
    // change the topic to the value of topic argument
    const requestBody: PBIMSetGroupNameReq = {
      customID: this.options.token || ioscatToken(),
      groupName: topic,
      platformGid: roomId,
      serviceID: CONSTANT.serviceID,
    }
    const body = (await this.API.imApiSetGroupNamePost(requestBody)).body
    if (body.code === 0) {
      await Promise.all([
        this.roomPayloadDirty(roomId)
      ])
      log.silly('PuppetIosCat', 'roomTopic(%s, %s)', roomId, topic)
      return
    }
    throw new Error('change room\'s topic error.')
  }
  // TODO: emit room-create event and test
  public async roomCreate (
    contactIdList: string[],
    topic: string,
  ): Promise<string> {
    log.verbose('PuppetIoscat', 'roomCreate(%s, %s)', JSON.stringify(contactIdList), topic)
    const requestBody: PBIMCreateGroupReq = {
      customID: this.options.token || ioscatToken(),
      groupName: topic,
      memberCustomIDs: contactIdList,
      serviceID: CONSTANT.serviceID
    }
    const body = (await this.API.imApiCreateGroupPost(requestBody)).body
    let platformGid: string = ''
    if (body.code === 0) {
      IosCatEvent.once('room-create', (roomId, newTopic) => {
        if (topic === newTopic) {
          platformGid = roomId
        }
      })

      /**
       * Give Server some time to the join message payload
       */
      await new Promise((r) => setTimeout(r, 1000))
      if (platformGid === '') {
        await new Promise((r) => setTimeout(r, 1000))
      }
      await this.iosCatManager.roomRawPayload(platformGid)
      return platformGid
    }
    throw new Error('Server error')
  }

  public async roomQuit (roomId: string): Promise<void> {
    log.verbose('PuppetIoscat', 'roomQuit(%s)', roomId)
    throw new Error('not supported')

  }

  // TODO: test
  public async roomQrcode (roomId: string): Promise<string> {
    if (!this.iosCatManager) {
      throw new Error('no ioscat manager')
    }
    const room = await this.iosCatManager.roomRawPayload(roomId)
    return room.qrcode || ''
  }

  // TODO: test
  public async roomMemberList (roomId: string): Promise<string[]> {
    log.verbose('PuppetIoscat', 'roommemberList(%s)', roomId)
    if (!this.iosCatManager) {
      throw new Error('no padchat manager')
    }

    const memberIdList = await this.iosCatManager.getRoomMemberIdList(roomId)
    log.silly('PuppetIoscat', 'roomMemberList()=%d', memberIdList.length)

    if (memberIdList.length <= 0) {
      await this.roomPayloadDirty(roomId)
    }

    return memberIdList
  }

  public async roomMemberRawPayload (roomId: string, contactId: string): Promise<IosCatRoomMemberRawPayload> {
    log.verbose('PuppetIoscat', 'roomMemberRawPayload(%s, %s)', roomId, contactId)
    if (!this.iosCatManager) {
      throw new Error('no ioscat manager')
    }
    const memberDictRawPayload = await this.iosCatManager.roomMemberRawpayload(roomId)
    return memberDictRawPayload[contactId]
  }

  public async roomMemberRawPayloadParser (rawPayload: IosCatRoomMemberRawPayload): Promise<RoomMemberPayload> {
    log.verbose('PuppetIoscat', 'roomMemberRawPayloadParser(%s)', rawPayload)
    const contactPayload = await this.iosCatManager.roomRawPayload(rawPayload.platformUid)
    return {
      avatar: contactPayload.avatar,
      id: rawPayload.platformUid,
      inviterId: rawPayload.source,
      name: contactPayload.name,
      roomAlias: rawPayload.alias,
    }
  }

  public async roomMemberPayloadDirty (roomId: string) {
    log.silly('PuppetIoscat', 'roomMemberRawPayloadDirty(%s)', roomId)

    if (this.iosCatManager) {
      await this.iosCatManager.roomMemberRawPayloadDirty(roomId)
    }

    await super.roomMemberPayloadDirty(roomId)
  }

  public async roomPayloadDirty (roomId: string): Promise<void> {
    log.verbose('PuppetIoscat', 'roomPayloadDirty(%s)', roomId)

    if (this.iosCatManager) {
      this.iosCatManager.roomRawPayloadDirty(roomId)
    }

    await super.roomPayloadDirty(roomId)
  }

  public async roomAnnounce (roomId: string): Promise<string>
  public async roomAnnounce (roomId: string, text: string): Promise<void>

  public async roomAnnounce (roomId: string, text?: string): Promise<void | string> {
    const roomRawPayload = await this.iosCatManager.roomRawPayload(roomId)
    if (text) {
      const requestBody: PBIMSetGroupDescReq = {
        customID: this.options.token || ioscatToken(),
        groupDesc: text,
        platformGid: roomId,
        serviceID: CONSTANT.serviceID
      }
      const body = (await this.API.imApiSetGroupDescPost(requestBody)).body
      if (body.code === 0) {
        log.verbose('roomAnnounce(roomId: %s, text: %s)', roomId, text)
        return
      }
    }
    log.verbose('roomAnnounce(roomId: %s)', roomId)
    return roomRawPayload.signature || ''
  }

  /**
   *
   * Friendship
   *
   */
  // 特殊消息的messageId
  public async friendshipRawPayload (id: string): Promise<any> {
    return { id } as any
  }
  public async friendshipRawPayloadParser (rawPayload: any): Promise<FriendshipPayload> {
    return rawPayload
  }

  public async friendshipAdd (
    contactId: string,
    hello: string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'friendshipAdd(%s, %s)', contactId, hello)
  }

  public async friendshipAccept (
    friendshipId: string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'friendshipAccept(%s)', friendshipId)
  }

  public ding (data?: string): void {
    log.silly('PuppetIoscat', 'ding(%s)', data || '')
    this.emit('dong', data)
    return
  }

  public async roomInvitationAccept (roomInvitationId: string): Promise<void> {
    log.silly('roomInvitationAccept (%s)', roomInvitationId)
  }

  public async roomInvitationRawPayload (rawPayload: any): Promise<any> {
    log.silly('roomInvitationRawPayload (%o)', rawPayload)
    return {} as any
  }

  public async roomInvitationRawPayloadParser (rawPayload: any): Promise<any> {
    log.silly('roomInvitationRawPayloadParser (%o)', rawPayload)
    return {} as any
  }

  /**
   * Look for room join event
   */
  protected async onIosCatMessageRoomEventJoin (rawPayload: IoscatMessageRawPayload): Promise<void> {
    log.verbose('PuppetIoscat', 'onIosCatMessageRoomEventJoin({id=%s})', rawPayload.id)

    const roomJoinEvent = roomJoinEventMessageParser(rawPayload)

    if (roomJoinEvent) {

      const inviteeNameList = roomJoinEvent.inviteeNameList
      const inviterName     = roomJoinEvent.inviterName
      const roomId          = roomJoinEvent.roomId
      log.silly('PuppetIoscat', 'onIosCatMessageRoomEventJoin() roomJoinEvent="%s"', JSON.stringify(roomJoinEvent))
      const roomPayload = await this.iosCatManager.roomRawPayload(roomId)
      // Because the members are new added into the room, we need to
      // clear the cache, and reload
      await Promise.all([
        this.roomMemberPayloadDirty(roomId),
        this.roomPayloadDirty(roomId)
      ])
      const inviteeIdList = flatten<string>(
        await Promise.all(
          inviteeNameList.map(
            inviteeName => this.roomMemberSearch(roomId, inviteeName),
          ),
        ),
      )

      if (inviteeIdList.length < 1) {
        throw new Error('inviteeIdList not found')
      }

      const inviterIdList = await this.roomMemberSearch(roomId, inviterName)

      if (inviterIdList.length < 1) {
        throw new Error('no inviterId found')
      } else if (inviterIdList.length > 1) {
        log.warn('PuppetIoscat', 'onPadchatMessageRoomEvent() case PadchatMesssageSys:',
        'inviterId found more than 1, use the first one.')
      }

      const inviterId = inviterIdList[0]

      this.emit('room-join', roomId, inviteeIdList,  inviterId)
      // To judge whether the room is just created or not
      IosCatEvent.emit('room-create', roomId, roomPayload.name)
    }
  }

  /**
   * Look for room leave event
   */
  protected async onIoscatMessageRoomEventLeave (rawPayload: IoscatMessageRawPayload): Promise<void> {
    log.verbose('PuppetIoscat', 'onPadchatMessageRoomEventLeave({id=%s})', rawPayload.id)

    const roomLeaveEvent = roomLeaveEventMessageParser(rawPayload)

    if (roomLeaveEvent) {
      const leaverNameList = roomLeaveEvent.leaverNameList
      const removerName    = roomLeaveEvent.removerName
      const roomId         = roomLeaveEvent.roomId
      log.silly('PuppetIoscat', 'onIoscatMessageRoomEventLeave() roomLeaveEvent="%s"', JSON.stringify(roomLeaveEvent))

      const leaverIdList = flatten<string>(
        await Promise.all(
          leaverNameList.map(
            leaverName => this.roomMemberSearch(roomId, leaverName),
          ),
        ),
      )
      const removerIdList = await this.roomMemberSearch(roomId, removerName)
      if (removerIdList.length < 1) {
        throw new Error('no removerId found')
      } else if (removerIdList.length > 1) {
        log.warn('PuppetIoscat', 'onPadchatMessage() case PadchatMesssageSys: removerId found more than 1',
        'use the first one.')
      }
      const removerId = removerIdList[0]

      if (!this.iosCatManager) {
        throw new Error('no padchatManager')
      }

      /**
       * Set Cache Dirty
       */
      await this.roomMemberPayloadDirty(roomId)
      await this.roomPayloadDirty(roomId)

      this.emit('room-leave',  roomId, leaverIdList, removerId)
    }
  }
  /**
   * Look for room topic event
   */
  protected async onIoscatMessageRoomEventTopic (rawPayload: IoscatMessageRawPayload): Promise<void> {
    log.verbose('PuppetIoscat', 'onIoscatMessageRoomEventTopic({id=%s})', rawPayload.id)

    const roomTopicEvent = roomTopicEventMessageParser(rawPayload)

    log.silly(JSON.stringify(rawPayload, null, 2))

    if (roomTopicEvent) {
      const changerName = roomTopicEvent.changerName
      const newTopic    = roomTopicEvent.topic
      const roomId      = roomTopicEvent.roomId
      log.silly('PuppetIoscat', 'onIoscatMessageRoomEventTopic() roomTopicEvent="%s"', JSON.stringify(roomTopicEvent))

      const roomOldPayload = await this.roomPayload(roomId)
      const oldTopic       = roomOldPayload.topic

      const changerIdList = await this.roomMemberSearch(roomId, changerName)
      if (changerIdList.length < 1) {
        throw new Error('no changerId found')
      } else if (changerIdList.length > 1) {
        log.warn('PuppetIoscat', 'onIoscatMessage() case IoscatMesssageSys:changerId found more than 1,',
        'use the first one.')
      }
      const changerId = changerIdList[0]

      if (!this.iosCatManager) {
        throw new Error('no padchatManager')
      }
      /**
       * Set Cache Dirty
       */
      await this.roomPayloadDirty(roomId)

      this.emit('room-topic',  roomId, newTopic, oldTopic, changerId)
    }
  }
}

export default PuppetIoscat
