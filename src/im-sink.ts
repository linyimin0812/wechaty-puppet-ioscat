import { EventEmitter } from 'events'
import * as amqp from 'amqplib/callback_api'
class IMSink {
  // 连接消息队列
  static conn
  // 消息队列通道
  static channel

  static event = new EventEmitter()
  static async getConn() {
    return new Promise((resolve, reject) => {
      if (this.conn) {
        resolve(this.conn)
        return
      }
      amqp.connect('amqp://admin:qwertyuiop@39.108.78.208:5672', (err, conn) => {
        if (err) {
          reject(err)
          console.log('Connect error', err)
          return
        }
        this.conn = conn
        resolve(conn)
        console.log('Connect success')
      })
    })
  }
  static async getChannel() {
    return new Promise((resolve, reject) => {
      if (this.channel) {
        resolve(this.channel)
        //console.log('获取消息队列通道成功')
        return
      }
      this.conn.createChannel((err, ch) => {
        if (err) {
          reject(err)
          console.log('获取消息队列通道失败', err)
          return
        }
        this.channel = ch
        resolve(ch)
        console.log('获取消息队列通道成功')
      })
    })
  }
  static async subscribe(topic, callback) {
    return new Promise((resolve, reject) => {
      this.channel.assertExchange('micro', 'topic', { durable: false })
      this.channel.assertQueue('test2', { durable: false }, (err, q) => {
        if (err) {
          reject(err)
          console.log('绑定消息队列失败,无法完成消息的订阅')
          return
        }
        this.channel.bindQueue(q.queue, 'micro', topic)
        this.channel.consume(q.queue, msg => {
          const obj = JSON.parse(msg.content.toString())
          callback(obj)
        }, { noAck: true })
      })
    })
  }

  static async start(topic: string) {
    try {
      if (!IMSink.conn) {
        IMSink.conn = await this.getConn()
      }
      if (!IMSink.channel) {
        IMSink.channel = await this.getChannel()
      }
      // 订阅相关消息
      this.subscribe(topic, msg => {
        //console.log(msg)
          this.event.emit('MESSAGE', msg)
          return
      })
    } catch (err) {
      console.log(err)
    }
    process.once('SIGINT',function(){
      IMSink.conn.close();
      console.log('Amqp链接关闭')
    });
  }
}

export default IMSink