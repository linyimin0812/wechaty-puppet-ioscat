#!/usr/bin/env ts-node

// tslint:disable:no-shadowed-variable
import test  from 'blue-tape'
import {
  tranferXmlToText,
}                           from './room-event-xml-message-parser'

test('tranferXmlToText ', async t => {
  const TEXT         = `12519001238@chatroom:
  <sysmsg type="sysmsgtemplate">
  	<sysmsgtemplate>
  		<content_template type="tmpl_type_profilewithrevokeqrcode">
  			<plain><![CDATA[]]></plain>
  			<template><![CDATA["$adder$"通过扫描你分享的二维码加入群聊  $revoke$]]></template>
  			<link_list>
  				<link name="adder" type="link_profile">
  					<memberlist>
  						<member>
  							<username><![CDATA[wxid_nbwjlkw19lkw22]]></username>
  							<nickname><![CDATA[linyimin说]]></nickname>
  						</member>
  					</memberlist>
  				</link>
  				<link name="revoke" type="link_revoke_qrcode" hidden="1">
  					<title><![CDATA[撤销]]></title>
  					<username><![CDATA[wxid_nbwjlkw19lkw22]]></username>
  					<qrcode><![CDATA[http://weixin.qq.com/g/AVmifqCT4aPyudeJ]]></qrcode>
  				</link>
  			</link_list>
  		</content_template>
  	</sysmsgtemplate>
  </sysmsg>`
  const EXPECTED_TEXT = '"linyimin"通过扫描你分享的二维码加入群聊  wxid_nbwjlkw19lkw22'
  const result = await tranferXmlToText(TEXT)
  t.deepEqual(result, EXPECTED_TEXT, 'should parse xml to text right')

})
