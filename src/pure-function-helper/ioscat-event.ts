import { EventEmitter } from 'events'

const IOSCAT_EVENT = {
  'broken': 'lym',
  'heartbeat': 'lym',
  'room-create': 'lym',
  'sync-contacts-and-room': 'lym'
}

type IosCatEventNmae = keyof typeof IOSCAT_EVENT
class Event extends EventEmitter {
  public emit (event: 'heartbeat', food: string): boolean
  public emit (event: 'broken', reason?: string): boolean
  public emit (event: 'room-create', roomId: string, topic: string): boolean
  public emit (event: 'sync-contacts-and-room'): boolean
  public emit (event: IosCatEventNmae, ...args: any[]): boolean {
    return super.emit(event, ...args)

  }

  public once (event: 'room-create', listener: (roomId: string, topic: string) => void): this
  public once (event: 'room-create', listener: (...args: any[]) => void): this {
    super.once(event, listener)
    return this
  }

  public on (event: 'broken', listener: (reason?: string) => void): this
  public on (event: 'heartbeat', listener: (food: string) => void): this
  public on (event: 'sync-contacts-and-room', listener: () => void): this
  public on (event: IosCatEventNmae, listener: (...args: any[]) => void): this {
    super.on(event, listener)
    return this
  }
}

export const IosCatEvent: Event = new Event()
