import {
  MessageType,
}                         from 'wechaty-puppet'

import {
  IosCatMessage,
  IoscatMessageRawPayload,
}                         from '../ioscat-schemas'

import equals from 'deep-equal'

export function messageType (
  rawPayload: IoscatMessageRawPayload,
): MessageType {

  const payload                = rawPayload.payload
  const payloadMessageType     = payload.messageType
  const payloadPlatformMsgType = payload.platformMsgType
  const payloadType            = {
    messageType: payloadMessageType,
    platformMsgType: payloadPlatformMsgType,
  }

  if (equals(IosCatMessage.Text, payloadType)) {
    return MessageType.Text
  }

  if (equals(IosCatMessage.Image, payloadType)) {
    return MessageType.Image
  }

  if (equals(IosCatMessage.Voice, payloadType)) {
    return MessageType.Audio
  }

  if (equals(IosCatMessage.Video, payloadType)) {
    return MessageType.Video
  }

  if (equals(IosCatMessage.ShareCard, payloadType)) {
    return MessageType.Contact
  }

  if (equals(IosCatMessage.File, payloadType)) {
    return MessageType.Attachment
  }
  return MessageType.Unknown
}
