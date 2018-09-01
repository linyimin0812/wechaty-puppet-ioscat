import {
  log,
}             from 'brolog'

import { xmlToJson } from './xml-to-json'

interface XmlMember {
  username: string,
  nickname: string,
}
interface XmlLink {
  $: {
    name : string,
    type : string,
  },
  memberlist?: {
    member : XmlMember | XmlMember[]
  },
  separator?    : string,
  title?        : string,
  usernamelist? : {username: string} | Array<{username: string}>,
  qrcode?       : string,
  plain?        : string,
  username      : string,
}

// type TemplateType = keyof typeof TEMPLATE_TYPE
interface XmlSchema {
  sysmsg: {
    $: {
      type: 'sysmsgtemplate',
    },
    sysmsgtemplate: {
      content_template: {
        $: {
          type: string
        },
        plain     : '',
        template  : string,
        link_list : {
          link: XmlLink | XmlLink[]
        }
      }
    }
  }
}

/**
 * tranfer the xml message to the follow format:
 * "$adder$"通过扫描你分享的二维码加入群聊"$revoke$"'
 * "$username$"邀请"$names$"加入了群聊
 * "$username$"邀请你加入了群聊，群聊参与人还有：$others$'
 * '你邀请"$names$"加入了群聊  $revoke$]'
 * '你将"linyimin说"移出了群聊'
 * @param xml
 */
export async function tranferXmlToText (message: string): Promise<string> {
  const xml = message.replace(/^[^\n]+\n/, '')
  log.silly(xml)
  const parse: XmlSchema = await xmlToJson(xml)
  let   template         = parse.sysmsg.sysmsgtemplate.content_template.template
  let   links            = parse.sysmsg.sysmsgtemplate.content_template.link_list.link
  log.silly('main', 'links: %s', JSON.stringify(links))
  if (! Array.isArray(links)) {
    links = [links]
  }
  for (const link of links) {
    let   content = ''
    const name    = link.$.name
    if (link.memberlist) {
      if (! Array.isArray(link.memberlist.member)) {
        link.memberlist.member = [link.memberlist.member]
      }
      for (const member of link.memberlist.member) {
        content += member.nickname + (link.separator || '')
      }
      content =  (link.separator && content[content.length - 1] === link.separator) ?
      content.slice(0, content.length - 1) : content
      template = template.replace(`$${name}$`, content)
      continue
    }
    if (link.username) {
      content  = link.username
      template = template.replace(`$${name}$`, content)
      log.silly('result:', template)
      continue
    }
    if (link.usernamelist) {
      if (! Array.isArray(link.usernamelist)) {
        link.usernamelist = [link.usernamelist]
      }
      for (const user of link.usernamelist) {
        content += user.username + (link.separator || '')
      }
      content =  (link.separator && content[content.length - 1] === link.separator) ?
      content.slice(0, content.length - 1) : content
      template = template.replace(`$${name}$`, content)
      log.silly('usernamelist', template)
      continue
    }
    if (link.plain) {
      content  = link.plain
      template = template.replace(`$${name}$`, content)
      continue
    }
  }
  return template
}
