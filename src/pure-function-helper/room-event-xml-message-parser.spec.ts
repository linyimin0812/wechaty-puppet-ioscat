#!/usr/bin/env ts-node

// tslint:disable:no-shadowed-variable
import test  from 'blue-tape'
import {
  tranferXmlToText,
}                           from './room-event-xml-message-parser'

test('$adder$"通过扫描你分享的二维码加入群聊"$revoke$"', async t => {
  const TEXT = `12519001238@chatroom:
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
  							<nickname><![CDATA[linyimin]]></nickname>
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

test('$username$"邀请"$names$"加入了群聊', async t => {
  const TEXT = `5338472179@chatroom:
  <sysmsg type="sysmsgtemplate">
    <sysmsgtemplate>
      <content_template type="tmpl_type_profile">
        <plain><![CDATA[]]></plain>
        <template><![CDATA["$username$"邀请"$names$"加入了群聊]]></template>
        <link_list>
          <link name="username" type="link_profile">
            <memberlist>
              <member>
                <username><![CDATA[wxid_j76jk7muhgqz22]]></username>
                <nickname><![CDATA[林贻民]]></nickname>
              </member>
            </memberlist>
          </link>
          <link name="names" type="link_profile">
            <memberlist>
              <member>
                <username><![CDATA[wxid_nbwjlkw19lkw22]]></username>
                <nickname><![CDATA[linyimin]]></nickname>
              </member>
            </memberlist>
            <separator><![CDATA[、]]></separator>
          </link>
        </link_list>
      </content_template>
    </sysmsgtemplate>
  </sysmsg>`
  const EXPECTED_TEXT = '"林贻民"邀请"linyimin"加入了群聊'
  const result = await tranferXmlToText(TEXT)
  t.deepEqual(result, EXPECTED_TEXT, 'should parse xml to text right')

})

test('你邀请"$names$"加入了群聊  $revoke$', async t => {
  const TEXT = `12519001238@chatroom:
  <sysmsg type="sysmsgtemplate">
    <sysmsgtemplate>
      <content_template type="tmpl_type_profilewithrevoke">
        <plain><![CDATA[]]></plain>
        <template><![CDATA[你邀请"$names$"加入了群聊  $revoke$]]></template>
        <link_list>
          <link name="names" type="link_profile">
            <memberlist>
              <member>
                <username><![CDATA[wxid_nbwjlkw19lkw22]]></username>
                <nickname><![CDATA[linyimin]]></nickname>
              </member>
            </memberlist>
            <separator><![CDATA[、]]></separator>
          </link>
          <link name="revoke" type="link_revoke" hidden="1">
            <title><![CDATA[撤销]]></title>
            <usernamelist>
              <username><![CDATA[wxid_nbwjlkw19lkw22]]></username>
            </usernamelist>
          </link>
        </link_list>
      </content_template>
    </sysmsgtemplate>
  </sysmsg>`
  const EXPECTED_TEXT = '你邀请"linyimin"加入了群聊  wxid_nbwjlkw19lkw22'
  const result = await tranferXmlToText(TEXT)
  t.deepEqual(result, EXPECTED_TEXT, 'should parse xml to text right')

})

test('你将"$kickoutname$"移出了群聊', async t => {
  const TEXT = `12519001238@chatroom:
  <sysmsg type="sysmsgtemplate">
    <sysmsgtemplate>
      <content_template type="tmpl_type_profile">
        <plain><![CDATA[]]></plain>
        <template><![CDATA[你将"$kickoutname$"移出了群聊]]></template>
        <link_list>
          <link name="kickoutname" type="link_profile">
            <memberlist>
              <member>
                <username><![CDATA[wxid_nbwjlkw19lkw22]]></username>
                <nickname><![CDATA[linyimin]]></nickname>
              </member>
            </memberlist>
          </link>
        </link_list>
      </content_template>
    </sysmsgtemplate>
  </sysmsg>`
  const EXPECTED_TEXT = '你将"linyimin"移出了群聊'
  const result = await tranferXmlToText(TEXT)
  t.deepEqual(result, EXPECTED_TEXT, 'should parse xml to text right')
})
