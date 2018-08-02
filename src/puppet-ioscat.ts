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
  MessageType,

  Puppet,
  PuppetOptions,

  Receiver,

  RoomMemberPayload,
  RoomPayload,
} from 'wechaty-puppet'

import {
  IoscatMessageRawPayload,
  IosCatContactRawPayload,
  IosCatRoomMemberRawPayload,
  IosCatRoomRawPayload
} from './ioscat-schemas'

import {
  log,
  qrCodeForChatie,
  CONSTANT,
  STATUS
} from './config'


import { default as IMSink } from './im-sink'

import { UUID, ioscatToken } from './config'
const cuid = require('cuid')

import {
  PBIMSendMessageReq,
  ApiApi,
  ContactApi,
  RelationApi,
  PBIMDeleteGroupMembersReq,
  PBIMAddGroupMembersReq,
  PBIMSetGroupNameReq,
  PBIMCreateGroupReq,
  PBIMSetGroupDescReq
} from './api'

import { IosCatManager } from './ioscat-manager'

import { messageRawPayloadParser } from './pure-function-helper/message-raw-parser'
import { IosCatEvent } from './pure-function-helper/ioscat-event';


export interface MockRoomRawPayload {
  topic: string,
  memberList: string[],
  ownerId: string,
}

export class PuppetIoscat extends Puppet {

  // ios API class instance
  private API: ApiApi = new ApiApi()
  private CONTACT_API = new ContactApi()
  private RELATION_API = new RelationApi()

  //private loopTimer?: NodeJS.Timer
  private readonly cacheIoscatMessagePayload: LRU.Cache<string, IoscatMessageRawPayload>

  private iosCatManager: IosCatManager = undefined

  constructor(
    public options: PuppetOptions = {},
  ) {
    super(options)

    const lruOptions: LRU.Options = {
      max: 10000,
      // length: function (n) { return n * 2},
      dispose(key: string, val: any) {
        log.silly('PuppetPadchat', 'constructor() lruOptions.dispose(%s, %s)', key, JSON.stringify(val))
      },
      maxAge: 1000 * 60 * 60,
    }

    this.cacheIoscatMessagePayload = new LRU<string, any>(lruOptions)

    this.iosCatManager = new IosCatManager(options)

  }

  public async start(): Promise<void> {
    log.verbose('PuppetIoscat', `start()`)

    this.state.on('pending')
    // await some tasks...
    this.initEventHook()
    let topic = `im.topic.13.${this.options.token || ioscatToken()}`

    log.silly('topic:%s', topic)
    IMSink.start(topic)

    this.state.on(true)

    this.id = this.options.token || ioscatToken()

    //  init cache
    await this.iosCatManager.initCache(this.id, CONSTANT.CUSTOM_ID)

    // sync roomMember, contact and room
    this.iosCatManager.syncContactsAndRooms()
    // const user = this.Contact.load(this.id)
    // emit contactId
    // TODO: 验证
    this.emit('login', this.id)
  }

  private initEventHook() {
    IMSink.event.on('MESSAGE', async msg => {
      msg['id'] = cuid()
      this.cacheIoscatMessagePayload.set(msg.id, msg)
      if (msg.type === 'ON_IM_MESSAGE_RECEIVED') {
        this.emit('message', msg.id)
        return
      }
      // 掉线信息
      if (msg.type === 'ON_DMS_HEARTBEAT_TIMEOUT' && msg.payload.toUpperCase() === UUID) {
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
  public async stop(): Promise<void> {
    log.verbose('PuppetIoscat', 'stop()')

    if (this.state.off()) {
      log.warn('PuppetIoscat', 'stop() is called on a OFF puppet. await ready(off) and return.')
      await this.state.ready('off')
      return
    }

    this.state.off('pending')

    // if (this.loopTimer) {
    //   clearInterval(this.loopTimer)
    // }

    // await some taks...
    // 关闭监听消息事件
    IMSink.getConn().then((CONN: any) => {
      CONN.close()
      console.log('Amqp链接关闭')
    }).catch(err => {
      log.error('IMSink get connection failed', err)
    });

    // release cache
    this.iosCatManager.releaseCache()

    this.state.off(true)
  }

  public async logout(): Promise<void> {
    log.verbose('PuppetIoscat', 'logout()')

    if (!this.id) {
      throw new Error('logout before login?')
    }

    this.emit('logout', this.id) // becore we will throw above by logonoff() when this.user===undefined
    this.id = undefined

    // do the logout job --> release cache
    this.iosCatManager.releaseCache()
  }

  /**
   *
   * Contact
   *
   */
  public contactAlias(contactId: string): Promise<string>
  public contactAlias(contactId: string, alias: string | null): Promise<void>

  public async contactAlias(contactId: string, alias?: string | null): Promise<void | string> {
    log.verbose('PuppetIoscat', 'contactAlias(%s, %s)', contactId, alias)

    if (typeof alias === 'undefined') {
      let contact = await this.contactPayload(contactId)
      return contact.alias || ''
    }
    throw new Error('not supported')
  }

  // TODO: test
  public async contactList(): Promise<string[]> {
    log.verbose('PuppetIoscat', 'contactList()')
    if (!this.iosCatManager) {
      throw new Error('no ioscat manager')
    }
    const contactIDs = this.iosCatManager.getContactList()
    return contactIDs
  }

  public async contactQrcode(contactId: string): Promise<string> {
    throw new Error('not supported')
    // return await this.bridge.WXqr
  }

  public async contactAvatar(contactId: string): Promise<FileBox>
  public async contactAvatar(contactId: string, file: FileBox): Promise<void>

  public async contactAvatar(contactId: string, file?: FileBox): Promise<void | FileBox> {
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

  public async contactRawPayload(id: string): Promise<IosCatContactRawPayload> {
    log.verbose('PuppetIoscat', 'contactRawPayload(%s)', id)
    const rawPayload: IosCatContactRawPayload = await this.iosCatManager.contactRawPayload(id)
    log.verbose('PuppetIoscat', 'rawPayload=%s', JSON.stringify(rawPayload))
    return rawPayload
  }

  public async contactRawPayloadParser(rawPayload: IosCatContactRawPayload): Promise<ContactPayload> {
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
      gender: gender,
      id: rawPayload.platformUid,
      name: rawPayload.nickname,
      type: contactType,
      city: rawPayload.city,
      province: rawPayload.state,
      signature: rawPayload.signature,
      weixin: rawPayload.customID
    }
    return payload
  }

  /**
   *
   * Message
   *
   */
  // TODO:
  public async messageFile(id: string): Promise<FileBox> {
    return FileBox.fromBase64(
      'cRH9qeL3XyVnaXJkppBuH20tf5JlcG9uFX1lL2IvdHRRRS9kMMQxOPLKNYIzQQ==',
      'mock-file' + id + '.txt',
    )
  }

  public async messageRawPayload(id: string): Promise<IoscatMessageRawPayload> {
    log.verbose('PuppetIoscat', 'messageRawPayload(%s)', id)
    const rawPayload = this.cacheIoscatMessagePayload.get(id)
    return rawPayload
  }

  public async messageRawPayloadParser(rawPayload: IoscatMessageRawPayload): Promise<MessagePayload> {
    log.verbose('PuppetIoscat', 'messagePayload(%s)', JSON.stringify(rawPayload, null, 2))
    let payload = messageRawPayloadParser(rawPayload)
    return payload
  }

  public async messageSendText(
    receiver: Receiver,
    text: string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'messageSend(%s, %s)', receiver, text)
    let data: PBIMSendMessageReq = new PBIMSendMessageReq()
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
  public async messageSendFile(
    receiver: Receiver,
    file: FileBox,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'messageSend(%s, %s)', receiver, file)
  }

  //TODO:
  public async messageSendContact(
    receiver: Receiver,
    contactId: string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'messageSend("%s", %s)', JSON.stringify(receiver), contactId)
    return
  }

  //TODO:
  public async messageForward(
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
  public async roomRawPayload(
    id: string,
  ): Promise<IosCatRoomRawPayload> {
    log.verbose('PuppetIoscat', 'roomRawPayload(%s)', id)

    if (!this.iosCatManager) {
      throw new Error('no ioscat manager')
    }
    const rawPayload = await this.iosCatManager.roomRawPayload(id)
    return rawPayload
  }

  public async roomRawPayloadParser(
    rawPayload: IosCatRoomRawPayload,
  ): Promise<RoomPayload> {
    log.verbose('PuppetIoscat', 'roomRawPayloadParser(%s)', JSON.stringify(rawPayload, null, 2))

    const payload: RoomPayload = {
      id: rawPayload.platformGid,
      memberIdList: rawPayload.memberIdList,
      topic: rawPayload.name,
      avatar: rawPayload.avatar,
      ownerId: rawPayload.ownerPlatformUid
    }
    return payload
  }

  public async roomList(): Promise<string[]> {
    log.verbose('PuppetIoscat', 'roomList()')
    let rooms = this.iosCatManager.getRoomIdList()
    return rooms
  }

  // TODO: test
  public async roomDel(
    roomId: string,
    contactId: string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'roomDel(%s, %s)', roomId, contactId)
    let requestBody: PBIMDeleteGroupMembersReq = {
      serviceID: CONSTANT.serviceID,
      customID: this.options.token || ioscatToken(),
      platformGid: roomId,
      memberCustomIDs: [
        contactId
      ]
    }

    const body = (await this.API.imApiDeleteGroupMembersPost(requestBody)).body
    if (body.code === 0) {
      log.info('PuppetIosCat', 'roomDel success')
    } else {
      log.info('PuppetIosCat', 'roomDel failed')
    }
  }

  public async roomAvatar(roomId: string): Promise<FileBox> {
    log.verbose('PuppetIoscat', 'roomAvatar(%s)', roomId)

    const payload = await this.roomPayload(roomId)

    if (payload.avatar) {
      return FileBox.fromUrl(payload.avatar)
    }
    log.warn('PuppetIoscat', 'roomAvatar() avatar not found, use the chatie default.')
    return qrCodeForChatie()
  }

  //TODO: test
  public async roomAdd(
    roomId: string,
    contactId: string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'roomAdd(%s, %s)', roomId, contactId)
    const requestBody: PBIMAddGroupMembersReq = {
      serviceID: CONSTANT.serviceID,
      customID: this.options.token || ioscatToken(),
      platformGid: roomId,
      memberCustomIDs: [
        contactId
      ]
    }
    const body = (await this.API.imApiAddGroupMembersPost(requestBody)).body
    if (body.code === 0) {
      log.info('PuppetIosCat', 'roomAdd success')
    } else {
      log.info('PuppetIosCat', 'roomAdd failed')
    }
  }

  public async roomTopic(roomId: string): Promise<string>
  public async roomTopic(roomId: string, topic: string): Promise<void>
  // TODO: test
  public async roomTopic(
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
      serviceID: CONSTANT.serviceID,
      customID: this.options.token || ioscatToken(),
      platformGid: roomId,
      groupName: topic
    }
    const body = (await this.API.imApiSetGroupNamePost(requestBody)).body
    if (body.code === 0) {
      log.silly('PuppetIosCat', 'roomTopic(%s, %s)', roomId, topic)
      return
    }
    throw new Error('change room\'s topic error.')
  }
  // TODO: emit room-create event and test
  public async roomCreate(
    contactIdList: string[],
    topic: string,
  ): Promise<string> {
    log.verbose('PuppetIoscat', 'roomCreate(%s, %s)', JSON.stringify(contactIdList), topic)
    const requestBody: PBIMCreateGroupReq = {
      serviceID: CONSTANT.serviceID,
      customID: this.options.token || ioscatToken(),
      groupName: topic,
      memberCustomIDs: contactIdList
    }
    const body = (await this.API.imApiCreateGroupPost(requestBody)).body
    let platformGid: string = ''
    if (body.code === 0) {
      IosCatEvent.once('room-create', function (roomId, newTopic) {
        if (topic === newTopic) {
          platformGid = roomId
        }
      })

      /**
       * Give Server some time to the join message payload
       */
      await new Promise(r => setTimeout(r, 1000))
      await this.iosCatManager.roomRawPayload(platformGid)
      return platformGid
    }
    throw new Error('Server error')
  }

  public async roomQuit(roomId: string): Promise<void> {
    log.verbose('PuppetIoscat', 'roomQuit(%s)', roomId)
    throw new Error('not supported')

  }

  // TODO: test
  public async roomQrcode(roomId: string): Promise<string> {
    if (!this.iosCatManager) {
      throw new Error('no ioscat manager')
    }
    const room = await this.iosCatManager.roomRawPayload(roomId)
    return room.qrcode || ''
  }

  // TODO: test
  public async roomMemberList(roomId: string): Promise<string[]> {
    log.verbose('PuppetIoscat', 'roommemberList(%s)', roomId)
    if (!this.iosCatManager) {
      throw new Error('no padchat manager')
    }

    const memberIdList = await this.iosCatManager.getRoomMemberIdList(roomId)
    log.silly('PuppetPadchat', 'roomMemberList()=%d', memberIdList.length)

    if (memberIdList.length <= 0) {
      await this.roomPayloadDirty(roomId)
    }

    return memberIdList
  }

  public async roomMemberRawPayload(roomId: string, contactId: string): Promise<IosCatRoomMemberRawPayload> {
    log.verbose('PuppetIoscat', 'roomMemberRawPayload(%s, %s)', roomId, contactId)
    if (!this.iosCatManager) {
      throw new Error('no ioscat manager')
    }
    const memberDictRawPayload = await this.iosCatManager.roomMemberRawpayload(roomId)
    return memberDictRawPayload[contactId]
  }

  public async roomMemberRawPayloadParser(rawPayload: IosCatRoomMemberRawPayload): Promise<RoomMemberPayload> {
    log.verbose('PuppetIoscat', 'roomMemberRawPayloadParser(%s)', rawPayload)
    const contactPayload = await this.iosCatManager.roomRawPayload(rawPayload.platformUid)
    return {
      avatar: contactPayload.avatar,
      id: rawPayload.platformUid,
      name: contactPayload.name,
      roomAlias: rawPayload.alias,
      inviterId: rawPayload.source
    }
  }

  public async roomAnnounce(roomId: string): Promise<string>
  public async roomAnnounce(roomId: string, text: string): Promise<void>

  public async roomAnnounce(roomId: string, text?: string): Promise<void | string> {
    const roomRawPayload = await this.iosCatManager.roomRawPayload(roomId)
    if (text) {
      const requestBody: PBIMSetGroupDescReq = {
        serviceID: CONSTANT.serviceID,
        customID: this.options.token || ioscatToken(),
        groupDesc: text,
        platformGid: roomId
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
  public async friendshipRawPayload(id: string): Promise<any> {
    return { id } as any
  }
  public async friendshipRawPayloadParser(rawPayload: any): Promise<FriendshipPayload> {
    return rawPayload
  }

  public async friendshipAdd(
    contactId: string,
    hello: string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'friendshipAdd(%s, %s)', contactId, hello)
  }

  public async friendshipAccept(
    friendshipId: string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'friendshipAccept(%s)', friendshipId)
  }

  public ding(data?: string): void {
    log.silly('PuppetIoscat', 'ding(%s)', data || '')
    this.emit('dong', data)
    return
  }

}

export default PuppetIoscat
