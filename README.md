# PUPPET-IOSCAT

[![NPM Version](https://badge.fury.io/js/wechaty-puppet-ioscat.svg)](https://badge.fury.io/js/wechaty-puppet-ioscat)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Linux/Mac Build Status](https://travis-ci.com/lym152898/wechaty-puppet-ioscat.svg?branch=master)](https://travis-ci.com/lym152898/wechaty-puppet-ioscat)

![chatie puppet](https://chatie.io/wechaty-puppet-ioscat/images/ioscat.png)

## USAGE

```ts
import { MemoryCard } from 'memory-card'
import { PuppetIoscat } from 'wechaty-puppet-ioscat'

const puppet  = new PuppetIoscat({ memory: new MemoryCard() })
const wechaty = new Wechaty({ puppet })
```

## AUTHOR

Yimin LIN \<linyimin520812@gmail.com\>

## COPYRIGHT & LICENSE

* Code & Docs © 2018 Yimin LIN \<linyimin520812@gmail.com\>
* Code released under the Apache-2.0 License
* Docs released under Creative Commons
