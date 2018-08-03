#!/usr/bin/env ts-node

// tslint:disable:no-console

import {
  PuppetIoscat,
}                 from 'wechaty-puppet-ioscat'

async function main () {
  const puppet = new PuppetIoscat()
  console.log(`Puppet v${puppet.version()} smoke testing passed.`)
  return 0
}

main()
.then(process.exit)
.catch(e => {
  console.error(e)
  process.exit(1)
})
