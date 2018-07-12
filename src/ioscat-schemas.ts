export interface IoscatMessageRawPayload {

  // { payload:
  //   { profilePlatformUid: ,
  //     profileCustomID: 'dancewuli',
  //     platformUid: 'wxid_j76jk7muhgqz22',
  //     customID: 'lymbupy',
  //     direction: 2,
  //     messageType: 1,
  //     sessionType: 1,
  //     platformMsgType: 1,
  //     content: 'hello',
  //     revoke: 2,
  //     sendTime: 1531313602,
  //     snapshot: 'hello',
  //     serviceID: 13,
  //     platformMsgID: '144',
  //     deviceID: 'c08e89b931699b60c0551fa6d4a4343c55de183d' },
  //  type: 'ON_IM_MESSAGE_RECEIVED' }
  id: string,   // 消息ID
  payload: {
    profilePlatformUid: string,   // 运营号平台Uid
    profileCustomID: string,      // 运营号平台自定义ID(微信号)
    platformUid: string,          // 联系人平台Uid
    customID: string,             // 联系人平台自定义ID(微信号)
    direction: number,            // 方向,相对于运营号 1 收到， 2 发出
    messageType: number,          // 消息类型
    sessionType: number,          // 会话类型 P2P=1, G2G=2
    platformMsgType: number,      // 平台消息类型
    content: string,              // 消息内容
    revoke: number,               // 是否撤销
    sendTime: number,             // 消息实际发送时间
    snapshot: string,             // 快照
    serviceID: number,            // 服务ID
    platformMsgID: string,        // 平台消息ID
    deviceID: string              // 设备唯一ID e.g UDID IMEI
  },
  type: string,
}

export interface IosCatContactRawPayload {
  // {
  //   "code": 0,
  //   "data": {
  //     "id": 26425882054657,
  //     "platformUid": "wxid_j76jk7muhgqz22",
  //     "customID": "lymbupy",
  //     "nickname": "林贻民",
  //     "avatar": "http://wx.qlogo.cn/mmhead/ver_1/Wu9XiakD8zKichzEBQmAgJwkJZK6L7VS3yOVRRKGVQRoyOc0sQQymmoicC92q9bhToDiah3L5twHeU6ibPZSz54feSIReicBnbvLqbRkUlN6mFQjc/132",
  //     "gender": 1,
  //     "country": "中国",
  //     "state": "海南",
  //     "city": "海口",
  //     "signature": "string",
  //     "type": 1,
  //     "serviceID": 13,
  //     "extra": "string",
  //     "ctime": 1522510040
  //   },
  //   "msg": ""
  // }
  id: number,             // 系统分配运营号ID
  platformUid: string,    // 平台uid
  customID: string,       // 联系人平台自定义ID(微信号)
  nickname: string,       // 昵称
  avatar: string,         // 头像
  gender: number,         // 性别(0-未知, 1-男,2-女)
  country: string,        // 国家
  state: string,          // 省份
  city: string,           // 城市
  signature: string,      // 签名
  type: number,           // 类型
  serviceID: number,      // 服务号
  extra: string,          // 扩展字段
  ctime: number           // 记录数据库时间

}