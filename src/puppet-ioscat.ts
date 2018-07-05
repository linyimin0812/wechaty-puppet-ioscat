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
import path  from 'path'

import LRU      from 'lru-cache'

import {
  FileBox,
}             from 'file-box'

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
}                       from 'wechaty-puppet'

import {
  log,
  qrCodeForChatie,
}                   from './config'


import {default as IMSink} from './im-sink'

import {UUID, ioscatToken, customID} from './config'
const uuidv1 = require('uuid/v1') 

import {PBIMSendMessageReq, ApiApi} from './api'
export interface MockContactRawPayload {
  name : string,
}

export interface IoscatMessageRawPayload {
  id                    : string,
  payload               : {
    profilePlatformUid  : string,
    profileCustomID     : string,
    platformUid         : string,
    customID            : string,
    direction           : number,
    messageType         : number,
    sessionType         : number,
    platformMsgType     : number,
    content             : string,
    revoke              : number,
    sendTime            : number,
    snapshot            : string,
    serviceID           : number,
    platformMsgID       : string,
    deviceID            : string 
  },
  type                  : string,
}

export interface MockRoomRawPayload {
  topic      : string,
  memberList : string[],
  ownerId    : string,
}

export class PuppetIoscat extends Puppet {

  private loopTimer?: NodeJS.Timer
  private readonly cacheIoscatMessagePayload: LRU.Cache<string, IoscatMessageRawPayload>

  constructor (
    public options: PuppetOptions = {},
  ) {
    super(options)

    const lruOptions: LRU.Options = {
      max: 10000,
      // length: function (n) { return n * 2},
      dispose (key: string, val: any) {
        log.silly('PuppetPadchat', 'constructor() lruOptions.dispose(%s, %s)', key, JSON.stringify(val))
      },
      maxAge: 1000 * 60 * 60,
    }

    this.cacheIoscatMessagePayload = new LRU<string, any>(lruOptions)

  }

  public async start (): Promise<void> {
    log.verbose('PuppetIoscat', `start()`)

    this.state.on('pending')
    // await some tasks...
    this.initEventHook()
    let topic = `im.topic.13.${this.options.token || ioscatToken()}`
    IMSink.start(topic)

    this.state.on(true)

    this.id = this.options.token || ioscatToken()
    // const user = this.Contact.load(this.id)
    this.emit('login', this.id)

    // const MOCK_MSG_ID = 'mockid'
    // this.cacheMessagePayload.set(MOCK_MSG_ID, {
    //   fromId    : 'xxx',
    //   id        : MOCK_MSG_ID,
    //   text      : 'mock text',
    //   timestamp : Date.now(),
    //   toId      : 'xxx',
    //   type      : MessageType.Text,
    // })

    // this.loopTimer = setInterval(() => {
    //   log.verbose('PuppetIoscat', `start() setInterval() pretending received a new message: ${MOCK_MSG_ID}`)
    //   this.emit('message', MOCK_MSG_ID)
    // }, 3000)

  }

  private initEventHook () {
    IMSink.event.on('MESSAGE', async msg => {
      msg['id'] = uuidv1()
      this.cacheIoscatMessagePayload.set(msg.id, msg)
      if (msg.type === 'ON_IM_MESSAGE_RECEIVED') {
        this.emit('message', msg.id)
        return
      }
      // 掉线信息
      if (msg.type === 'ON_DMS_HEARTBEAT_TIMEOUT' && msg.payload.toUpperCase() === UUID) {
        this.emit('error', msg.id)
        return
      }
      // 添加好友信息
      if (msg.type === 'ON_IM_RELATION_APPLY') {
        this.emit('friendship', msg.id)
        return
      }
    })
  }
  public async stop (): Promise<void> {
    log.verbose('PuppetIoscat', 'quit()')

    if (this.state.off()) {
      log.warn('PuppetIoscat', 'quit() is called on a OFF puppet. await ready(off) and return.')
      await this.state.ready('off')
      return
    }

    this.state.off('pending')

    if (this.loopTimer) {
      clearInterval(this.loopTimer)
    }

    // await some tasks...
    // 关闭监听消息事件
    IMSink.getConn().then((CONN: any) => {
      CONN.close()
      console.log('Amqp链接关闭')
    }).catch(err => {
      console.log(err)
    });
    
    this.state.off(true)
  }

  public async logout (): Promise<void> {
    log.verbose('PuppetIoscat', 'logout()')

    if (!this.id) {
      throw new Error('logout before login?')
    }

    this.emit('logout', this.id) // becore we will throw above by logonoff() when this.user===undefined
    this.id = undefined

    // TODO: do the logout job
  }

  /**
   *
   * Contact
   *
   */
  public contactAlias (contactId: string)                      : Promise<string>
  public contactAlias (contactId: string, alias: string | null): Promise<void>

  public async contactAlias (contactId: string, alias?: string | null): Promise<void | string> {
    log.verbose('PuppetIoscat', 'contactAlias(%s, %s)', contactId, alias)

    if (typeof alias === 'undefined') {
      return 'mock alias'
    }
    return
  }

  public async contactList (): Promise<string[]> {
    log.verbose('PuppetIoscat', 'contactList()')

    return []
  }

  public async contactQrcode (contactId: string): Promise<string> {
    if (contactId !== this.selfId()) {
      throw new Error('can not set avatar for others')
    }

    throw new Error('not supported')
    // return await this.bridge.WXqr
  }

  public async contactAvatar (contactId: string)                : Promise<FileBox>
  public async contactAvatar (contactId: string, file: FileBox) : Promise<void>

  public async contactAvatar (contactId: string, file?: FileBox): Promise<void | FileBox> {
    log.verbose('PuppetIoscat', 'contactAvatar(%s)', contactId)

    /**
     * 1. set
     */
    if (file) {
      return
    }

    /**
     * 2. get
     */
    const WECHATY_ICON_PNG = path.resolve('../../docs/images/wechaty-icon.png')
    return FileBox.fromFile(WECHATY_ICON_PNG)
  }

  public async contactRawPayload (id: string): Promise<MockContactRawPayload> {
    log.verbose('PuppetIoscat', 'contactRawPayload(%s)', id)
    const rawPayload: MockContactRawPayload = {
      name : 'mock name',
    }
    return rawPayload
  }

  public async contactRawPayloadParser (rawPayload: MockContactRawPayload): Promise<ContactPayload> {
    log.verbose('PuppetIoscat', 'contactRawPayloadParser(%s)', rawPayload)

    const payload: ContactPayload = {
      avatar : 'mock-avatar-data',
      gender : ContactGender.Unknown,
      id     : 'id',
      name   : 'mock-name',
      type   : ContactType.Unknown,
    }
    return payload
  }

  /**
   *
   * Message
   *
   */
  public async messageFile (id: string): Promise<FileBox> {
    return FileBox.fromBase64(
      'cRH9qeL3XyVnaXJkppBuH20tf5JlcG9uFX1lL2IvdHRRRS9kMMQxOPLKNYIzQQ==',
      'mock-file' + id + '.txt',
    )
  }

  public async messageRawPayload (id: string): Promise<IoscatMessageRawPayload> {
    log.verbose('PuppetIoscat', 'messageRawPayload(%s)', id)
    const rawPayload = this.cacheIoscatMessagePayload.get(id)
    return rawPayload
  }

  public async messageRawPayloadParser (rawPayload: IoscatMessageRawPayload): Promise<MessagePayload> {
    log.verbose('PuppetIoscat', 'messagePayload(%s)', rawPayload)
    let fromId  = rawPayload.payload.direction === 1 ? rawPayload.payload.profileCustomID : rawPayload.payload.customID
    let toId    = rawPayload.payload.direction === 1 ? rawPayload.payload.customID : rawPayload.payload.profileCustomID
    const payload: MessagePayload = {
      fromId    : fromId,
      id        : rawPayload.id,
      text      : rawPayload.payload.content,
      timestamp : rawPayload.payload.sendTime, // unix timestamp (seconds)
      toId      : toId,
      type      : this.messageType(rawPayload.payload.messageType),
    }
    return payload
  }

  /**
   * 原始payload中的messageType的值
   * @param messageType 
   * 
   * type	integer
      消息类型
      文本, 1
      语音, 2
      图片, 3
      视频, 4
      名片, 5
      链接, 6
      红包, 7
      转账, 8
      地址, 11
      好友请求, 12
      动画, 13
      语音聊天, 14
      视频聊天, 15
      模板消息, 18
      通知, 10000
   */
  public messageType(messageType: number): MessageType{
    switch(messageType){
      case 1:
        return MessageType.Text
      case 2:
        return MessageType.Audio
      case 3:
        return MessageType.Image
      case 4:
        return MessageType.Video
      case 5:
        return MessageType.Contact
      default:
        return MessageType.Unknown 
    }
  }
  public async messageSendText (
    receiver : Receiver,
    text     : string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'messageSend(%s, %s)', receiver, text)
    let api:ApiApi = new ApiApi()
    let data: PBIMSendMessageReq = new PBIMSendMessageReq()
    data.serviceID = 13
    data.fromCustomID = this.options.token || ioscatToken() // WECHATY_PUPPET_IOSCAT_TOKEN
    data.sessionType = 1
    data.content =text
    // 私聊
    if(receiver.contactId){
      data.toCustomID = receiver.contactId
    }else if(receiver.contactId){
      data.toCustomID = receiver.contactId
    }else{
      throw new Error('接收人名称不能为空')
    }
    api.imApiSendMessagePost(data)

  }

  public async messageSendFile (
    receiver : Receiver,
    file     : FileBox,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'messageSend(%s, %s)', receiver, file)
  }

  public async messageSendContact (
    receiver  : Receiver,
    contactId : string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'messageSend("%s", %s)', JSON.stringify(receiver), contactId)
    return
  }

  public async messageForward (
    receiver  : Receiver,
    messageId : string,
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
  ): Promise<MockRoomRawPayload> {
    log.verbose('PuppetIoscat', 'roomRawPayload(%s)', id)

    const rawPayload: MockRoomRawPayload = {
      memberList: [],
      ownerId   : 'mock_room_owner_id',
      topic     : 'mock topic',
    }
    return rawPayload
  }

  public async roomRawPayloadParser (
    rawPayload: MockRoomRawPayload,
  ): Promise<RoomPayload> {
    log.verbose('PuppetIoscat', 'roomRawPayloadParser(%s)', rawPayload)

    const payload: RoomPayload = {
      id           : 'id',
      memberIdList : [],
      topic        : 'mock topic',
    }

    return payload
  }

  public async roomList (): Promise<string[]> {
    log.verbose('PuppetIoscat', 'roomList()')

    return []
  }

  public async roomDel (
    roomId    : string,
    contactId : string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'roomDel(%s, %s)', roomId, contactId)
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

  public async roomAdd (
    roomId    : string,
    contactId : string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'roomAdd(%s, %s)', roomId, contactId)
  }

  public async roomTopic (roomId: string)                : Promise<string>
  public async roomTopic (roomId: string, topic: string) : Promise<void>

  public async roomTopic (
    roomId: string,
    topic?: string,
  ): Promise<void | string> {
    log.verbose('PuppetIoscat', 'roomTopic(%s, %s)', roomId, topic)

    if (typeof topic === 'undefined') {
      return 'mock room topic'
    }
    return
  }

  public async roomCreate (
    contactIdList : string[],
    topic         : string,
  ): Promise<string> {
    log.verbose('PuppetIoscat', 'roomCreate(%s, %s)', contactIdList, topic)

    return 'mock_room_id'
  }

  public async roomQuit (roomId: string): Promise<void> {
    log.verbose('PuppetIoscat', 'roomQuit(%s)', roomId)
  }

  public async roomQrcode (roomId: string): Promise<string> {
    return roomId + ' mock qrcode'
  }

  public async roomMemberList (roomId: string) : Promise<string[]> {
    log.verbose('PuppetIoscat', 'roommemberList(%s)', roomId)
    return []
  }

  public async roomMemberRawPayload (roomId: string, contactId: string): Promise<any>  {
    log.verbose('PuppetIoscat', 'roomMemberRawPayload(%s, %s)', roomId, contactId)
    return {}
  }

  public async roomMemberRawPayloadParser (rawPayload: any): Promise<RoomMemberPayload>  {
    log.verbose('PuppetIoscat', 'roomMemberRawPayloadParser(%s)', rawPayload)
    return {
      avatar    : 'mock-avatar-data',
      id        : 'xx',
      name      : 'mock-name',
      roomAlias : 'yy',
    }
  }

  public async roomAnnounce (roomId: string)                : Promise<string>
  public async roomAnnounce (roomId: string, text: string)  : Promise<void>

  public async roomAnnounce (roomId: string, text?: string) : Promise<void | string> {
    if (text) {
      return
    }
    return 'mock announcement for ' + roomId
  }

  /**
   *
   * Friendship
   *
   */
  public async friendshipRawPayload (id: string)            : Promise<any> {
    return { id } as any
  }
  public async friendshipRawPayloadParser (rawPayload: any) : Promise<FriendshipPayload> {
    return rawPayload
  }

  public async friendshipAdd (
    contactId : string,
    hello     : string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'friendshipAdd(%s, %s)', contactId, hello)
  }

  public async friendshipAccept (
    friendshipId : string,
  ): Promise<void> {
    log.verbose('PuppetIoscat', 'friendshipAccept(%s)', friendshipId)
  }

  public ding (data?: string): void {
    log.silly('PuppetIoscat', 'ding(%s)', data || '')
    this.emit('dong', data)
    return
  }

}

export default PuppetIoscat
