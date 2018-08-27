import {
  PuppetRoomTopicEvent,
  YOU,
}                         from 'wechaty-puppet'

import {
  IoscatMessageRawPayload,
}                         from '../ioscat-schemas'

import {
  isPayload,
  isRoomId,
}               from './is-type'

import { log } from '../config'
import { tranferXmlToText } from './room-event-xml-message-parser'

/**
 *
 * 3. Room Topic Event
 *
 */
const ROOM_TOPIC_OTHER_REGEX_LIST = [
  /^"(.+)" changed the group name to "(.+)"$/,
  /^"(.+)"修改群名为“(.+)”$/,
]

const ROOM_TOPIC_YOU_REGEX_LIST = [
  /^(You) changed the group name to "(.+)"$/,
  /^(你)修改群名为“(.+)”$/,
]

export async function roomTopicEventMessageParser (
  rawPayload: IoscatMessageRawPayload,
): Promise<null | PuppetRoomTopicEvent> {

  if (!isPayload(rawPayload)) {
    return null
  }

  const roomId  = rawPayload.payload.platformGid
  let content = rawPayload.payload.content
  if (content.indexOf('<sysmsg type="sysmsgtemplate">') > 0) {
    content = await tranferXmlToText(content)
  }
  log.silly('roomTopicEventMessageParser', 'content = %s', content)
  if (!roomId) {
    throw new Error('roomId is not exist')
  }

  if (!isRoomId(roomId)) {
    return null
  }

  let matchesForOther:  null | string[] = []
  let matchesForYou:    null | string[] = []

  ROOM_TOPIC_OTHER_REGEX_LIST .some(regex => !!(matchesForOther = content.match(regex)))
  ROOM_TOPIC_YOU_REGEX_LIST   .some(regex => !!(matchesForYou   = content.match(regex)))

  const matches: Array<string | YOU> = matchesForOther || matchesForYou
  if (!matches) {
    return null
  }

  let   changerName = matches[1]
  const topic       = matches[2] as string

  if (matchesForYou && changerName === '你' || changerName === 'You') {
    changerName = YOU
  }

  const roomTopicEvent: PuppetRoomTopicEvent = {
    changerName,
    roomId,
    topic,
  }

  return roomTopicEvent
}
