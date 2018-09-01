import * as amqp from 'amqplib'
import { EventEmitter } from 'events'
import { log } from './config'
class IMSink {
  private static connection: amqp.Connection
  private static channel: amqp.Channel
  public static event = new EventEmitter()
  public static async getConnection (): Promise<void> {
    log.silly('IMSink', 'getConnection()')
    try {
      IMSink.connection = await amqp.connect('amqp://admin:qwertyuiop@39.108.78.208:5672')
    } catch (err) {
      throw new Error(`IMSink getConn() error: ${JSON.stringify(err)}`)
    }
  }
  public static async getChannel (): Promise<void> {
    log.silly('IMSink', 'getChannel()')
    try {
      await IMSink.getConnection()
      IMSink.channel = await IMSink.connection.createChannel()
      return
    } catch (err) {
      throw new Error(`IMSink getChannel() error: ${JSON.stringify(err)}`)
    }
  }
  public static async start (topic: string) {
    log.silly('IMSink', 'subscribe(%s)', topic)
    try {
      await IMSink.getChannel()
      await IMSink.channel.assertExchange('micro', 'topic', { durable: false })
      const assertQueue = await IMSink.channel.assertQueue('test2', { durable: false })
      await IMSink.channel.bindQueue(assertQueue.queue, 'micro', topic)
      IMSink.channel.consume(assertQueue.queue, (msg: any) => {
        const obj = JSON.parse(msg.content.toString())
        this.event.emit('MESSAGE', obj)
      }, { noAck: true })
    } catch (err) {
      throw new Error(`subscribe message  error: ${err}`)
    }
  }

  public static async close () {
    await new Promise((r) => setTimeout(r, 1 * 1000))
    if (!IMSink.channel) {
      log.error('IMSink','close() %s', 'channel is null, dont need to close')
    } else {
      await IMSink.channel.close()
    }
    if (!IMSink.connection) {
      return log.error('IMSink','close() %s', 'connection is null, dont need to close')
    }
    await IMSink.connection.close()
    // remove allListener
    IMSink.event.removeAllListeners()
  }
}

export default IMSink
