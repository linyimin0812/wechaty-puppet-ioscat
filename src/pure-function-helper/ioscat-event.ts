import { EventEmitter } from 'events'

class Event extends EventEmitter {
  public emit (event: 'room-create', roomId: string, topic: string): boolean
  public emit (event: 'room-create', ...args: any[]): boolean {
    return super.emit(event, ...args)

  }

  public once (event: 'room-create', listener: (roomId: string, topic: string) => void): this
  public once (event: 'room-create', listener: (...args: any[]) => void): this {
    super.once(event, listener)
    return this
  }
}

export const IosCatEvent: Event = new Event()
