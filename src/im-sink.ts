import * as amqp from 'amqplib/callback_api'
import { EventEmitter } from 'events'
import { log } from './config'
class IMSink {
  // 连接消息队列
  public static conn: amqp.Connection | null
  // 消息队列通道
  public static channel: amqp.Channel | null

  public static event = new EventEmitter()
  public static async getConn (): Promise<amqp.Connection> {
    return new Promise<amqp.Connection>((resolve, reject) => {
      if (IMSink.conn) {
        resolve(IMSink.conn)
        return
      }
      amqp.connect('amqp://admin:qwertyuiop@39.108.78.208:5672', (err, conn) => {
        if (err) {
          reject(err)
          log.error('Connect error', err)
          return
        }
        this.conn = conn
        resolve(conn)
        log.silly('IMSink', 'Connect success')
      })
    })
  }
  public static async getChannel (): Promise<amqp.Channel> {
    log.silly('IMSink', 'getChannel()')
    return new Promise<amqp.Channel>((resolve, reject) => {
      if (this.channel) {
        resolve(this.channel)
        // console.log('获取消息队列通道成功')
        return
      }
      if (!IMSink.conn) {
        throw new Error('rabbitMQ is not connected, cant create a channel')
      }
      IMSink.conn.createChannel((err, ch) => {
        if (err) {
          reject(err)
          log.error('获取消息队列通道失败', err)
          return
        }
        this.channel = ch
        resolve(ch)
        log.silly('获取消息队列通道成功')
      })
    })
  }
  public static async subscribe (topic: string, callback: (obj: any) => void) {
    log.silly('IMSink', 'subscribe(%s)', topic)
    return new Promise((resolve, reject) => {
      if (!IMSink.channel) {
        throw new Error('rabbitMQ channel is not exist, cant subscribe a message')
      }
      IMSink.channel.assertExchange('micro', 'topic', { durable: false })
      IMSink.channel.assertQueue('test2', { durable: false }, (err, q) => {
        if (err) {
          reject(err)
          log.silly('','绑定消息队列失败,无法完成消息的订阅')
          return
        }
        if (!IMSink.channel) {
          throw new Error('rabbitMQ channel is not exist, cant subscribe a message')
        }
        IMSink.channel.bindQueue(q.queue, 'micro', topic)
        IMSink.channel.consume(q.queue, (msg: any) => {
          const obj = JSON.parse(msg.content.toString())
          callback(obj)
        }, { noAck: true })
      })
    })
  }

  public static async start (topic: string) {
    try {
      if (!IMSink.conn) {
        IMSink.conn = await this.getConn()
      }
      if (!IMSink.channel) {
        IMSink.channel = await this.getChannel()
      }
      // 订阅相关消息
      this.subscribe(topic, (msg) => {
        log.silly(msg)
        this.event.emit('MESSAGE', msg)
        return
      }).then(() => {
        log.silly('receive message')
      }).catch((err) => {
        log.error('receive message error:', err)
      })
    } catch (err) {
      log.error(err)
    }
    process.once('SIGINT', () => {
      if (!IMSink.conn) {
        return log.silly('Amqp链接关闭')
      }
      IMSink.conn.close()
      log.silly('Amqp链接关闭')
    })
  }

  public static async close () {
    if (!IMSink.channel) {
      return log.silly('channel is null, dont need to close')
    }
    await IMSink.channel.close((err) => {
      if (err) {
        log.error('IMSink', 'close(): %s', JSON.stringify(err))
      }
    })
    if (!IMSink.conn) {
      return log.silly('connection is null, dont need to close')
    }
    await IMSink.conn.close((err) => {
      if (err) {
        log.error('IMSink', 'close(): %s', JSON.stringify(err))
      }
    })
    IMSink.conn = IMSink.channel = null
  }
}

export default IMSink
