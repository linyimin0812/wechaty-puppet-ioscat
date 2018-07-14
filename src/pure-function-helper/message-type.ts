import {
  MessageType,
}                         from 'wechaty-puppet'

import {
  IosCatMessageType
}                         from '../ioscat-schemas'

export function messageType (
  rawType: IosCatMessageType,
): MessageType {
  let type: MessageType

  switch (rawType) {

    case IosCatMessageType.Text:
      type = MessageType.Text
      break

    case IosCatMessageType.Image:
      type = MessageType.Image
      // console.log(rawPayload)
      break

    case IosCatMessageType.Voice:
      type = MessageType.Audio
      // console.log(rawPayload)
      break

    case IosCatMessageType.Video:
      type = MessageType.Video
      // console.log(rawPayload)
      break

    case IosCatMessageType.ShareCard:
      type = MessageType.Contact
      break

    case IosCatMessageType.Animation:
    case IosCatMessageType.Transfer:
    case IosCatMessageType.Location:
    case IosCatMessageType.FriendRequest:
    case IosCatMessageType.Link:
      type = MessageType.Unknown
      break

    default:
      throw new Error('unsupported type: ' + IosCatMessageType[rawType] + '(' + rawType + ')')
  }

  return type
}
