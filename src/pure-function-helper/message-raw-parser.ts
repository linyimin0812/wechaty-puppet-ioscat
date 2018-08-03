// import { toJson } from 'xml2json'

import {
  MessagePayload,
  MessageType,
} from 'wechaty-puppet'

import {
  IoscatMessageRawPayload,
  // PadchatMessageType,
  // PadchatContactPayload,
} from '../ioscat-schemas'

import {
  messageType,
} from './message-type'

export function messageRawPayloadParser (
  rawPayload: IoscatMessageRawPayload,
): MessagePayload {

  // console.log('messageRawPayloadParser:', rawPayload)

  /**
   * 0. Set Message Type
   */
  const type = messageType(rawPayload.payload.messageType)

  const payloadBase = {
    id: rawPayload.id,
    timestamp: rawPayload.payload.sendTime,   // iosCat message timestamp is seconds
    type,
  } as {
    id: string,
    timestamp: number,
    type: MessageType,
    filename?: string,
  }

  // TODO: not deal with file, just realise the text
  // if (   type === MessageType.Image
  //     || type === MessageType.Audio
  //     || type === MessageType.Video
  //     || type === MessageType.Attachment
  // ) {
  //   payloadBase.filename = messageFileName(rawPayload) || undefined
  // }

  let fromId: undefined | string
  let roomId: undefined | string
  let toId: undefined | string

  let text: undefined | string

  /**
   * sessionType = 1 : P2P
   * sessionType = 2 : G2G
   */
  const sessionType = rawPayload.payload.sessionType

  /**
   * direction = 1 : operator recieve a message
   * direction = 2 : operator send a message
   */
  const direction = rawPayload.payload.direction
  /**
   * 1. Set Room Id
   */

  if (sessionType == 2) {
    roomId = rawPayload.payload.platformGid
  } else {
    roomId = undefined
  }

  /**
   * 2. Set To Contact Id
   */
  if (sessionType == 1) {
    if (direction === 1) {
      toId = rawPayload.payload.profilePlatformUid
    } else {
      toId = rawPayload.payload.platformUid
    }
  } else {
    toId = undefined
  }

  /**
   * 3. Set From Contact Id
   */
  if (direction === 1) {
    fromId = rawPayload.payload.platformUid
  } else {
    fromId = rawPayload.payload.profilePlatformUid
  }

  /**
   *
   * 4. Set Text
   */
  // TODO: judge the type of content, may need some special processing
  text = rawPayload.payload.content

  /**
   * 5.1 Validate Room & From ID
   */
  if (!roomId && !fromId) {
    throw Error('empty roomId and empty fromId!')
  }
  /**
   * 5.1 Validate Room & To ID
   */
  if (!roomId && !toId) {
    throw Error('empty roomId and empty toId!')
  }

  /**
   * 6. Set Contact for ShareCard
   */
  // if (type === MessageType.Contact) {
  //   interface XmlSchema {
  //     msg: {
  //       username: string,
  //       bigheadimgurl: string,
  //       nickname: string,
  //       province: string,
  //       city: string,
  //       sign: string,
  //       sex: number,
  //       antispamticket: string,
  //     },
  //     t: PadchatContactPayload,
  //   }
  //   const jsonPayload = JSON.parse(toJson(text)) as XmlSchema

  //   console.log('jsonPayload:', jsonPayload)
  // }

  let payload: MessagePayload

  // Two branch is the same code.
  // Only for making TypeScript happy
  if (fromId && toId) {
    payload = {
      ...payloadBase,
      fromId,
      roomId,
      text,
      toId,
    }
  } else if (roomId) {
    payload = {
      ...payloadBase,
      fromId,
      roomId,
      text,
      toId,
    }
  } else {
    throw new Error('neither toId nor roomId')
  }

  return payload
}
