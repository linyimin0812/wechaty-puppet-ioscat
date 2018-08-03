import * as amqp from 'amqplib/callback_api'
import { EventEmitter } from 'events'
import { log } from './config'
class IMSink {
  // 连接消息队列
  public static conn: amqp.Connection
  // 消息队列通道
  public static channel: amqp.Channel

  public static event = new EventEmitter()
  public static async getConn (): Promise<amqp.Connection> {
    return new Promise<amqp.Connection>((resolve, reject) => {
      if (this.conn) {
        resolve(this.conn)
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
    return new Promise<amqp.Channel>((resolve, reject) => {
      if (this.channel) {
        resolve(this.channel)
        // console.log('获取消息队列通道成功')
        return
      }
      this.conn.createChannel((err, ch) => {
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
    return new Promise((resolve, reject) => {
      this.channel.assertExchange('micro', 'topic', { durable: false })
      this.channel.assertQueue('test2', { durable: false }, (err, q) => {
        if (err) {
          reject(err)
          log.silly('','绑定消息队列失败,无法完成消息的订阅')
          return
        }
        this.channel.bindQueue(q.queue, 'micro', topic)
        this.channel.consume(q.queue, (msg: any) => {
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
      await this.subscribe(topic, (msg) => {
        // console.log(msg)
        this.event.emit('MESSAGE', msg)
        return
      })
    } catch (err) {
      log.error(err)
    }
    process.once('SIGINT', () => {
      IMSink.conn.close()
      log.silly('Amqp链接关闭')
    })
  }
}

export default IMSink
