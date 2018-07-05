import { PuppetIoscat } from '../src/'
import { Wechaty } from 'wechaty'

const puppet = new PuppetIoscat({
  token: 'xxx',
})

const wechaty = new Wechaty({ puppet })

wechaty.on('login', user => console.log(`login: ${user}`))
.on('message', msg => {
  console.log(`msg: ${msg}`)
})

wechaty.start()