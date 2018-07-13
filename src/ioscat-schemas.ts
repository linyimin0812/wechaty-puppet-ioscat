import { SSL_OP_DONT_INSERT_EMPTY_FRAGMENTS } from "constants";

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

export interface IosCatRoomMemberRawPayload {

  // {
  //   "id": 26916304982016,
  //   "contactID": 26354400891429,
  //   "platformUid": "wxid_1htfbf5cm7z322",
  //   "gid": 26354400890881,
  //   "platformGid": "8144046175@chatroom",
  //   "source": "wxid_aeopz1eoj9jx22",
  //   "serviceID": 13,
  //   "loaded": 2,
  //   "ctime": 1524380855
  // }
  id            :number,      // 系统分配ID
  contactID     :number,      // 系统分配联系人ID
  platformUid   :string,      // 平台uid
  gid           :string,      // 系统分配群ID
  platformGid   :string,      // 平台群ID
  source        :string,      // 成员来源
  serviceID     :number,      // 服务id
  loaded        :number,      // 信息是否完整记录
  ctime         :number,      // 数据库记录创建时间
  alas?         :string,      // 成员别名
  extra?        :string,      // 扩展字段
  tags?         :string       // 标签
}


export interface IosCatRoomRawPayload {
  // {
  //   "id": 26354400890881,
  //   "ownerPlatformUid": "qq512436430",
  //   "profilePlatformUid": "wxid_tdax1huk5hgs12",
  //   "platformGid": "8144046175@chatroom",
  //   "name": "舞哩团02群",
  //   "avatar": "http://wx.qlogo.cn/mmcrhead/PiajxSqBRaEIDG5azH8ZXhft6vkKhMHS4Ia7EYeGPRl7HzwkOSjiaiccqzfQYicUvnSq6G6WliaicWNScJFNmVVjAw0mmuqZEWiaGNk/0",
  //   "signature": "禁止任何广告，拒绝伸手党，否则一律踢",
  //   "qrcode": "http://cloudbrain-pic.oss-cn-shenzhen.aliyuncs.com/82ffc9a46079fe6bb6867a10b49deff8",
  //   "qrcodeGenerateTime": 1531313065,
  //   "memberCount": 237,
  //   "serviceID": 13
  // }
  id                        :number,      // 系统分配群ID
  ownerContactID            :string,      // 系统分配群主联系人ID
  ownerPlatformUid?         :string,      // 群主平台ID
  profilePlatformUid        :string,      // 运营号平台Uid
  ownerCustomID?            :string,      // 群主自定义ID
  platformGid               :string,      // 群ID
  profileContactID?         :string,      // 运营号系统分配联系人ID
  name                      :string,      // 群名称
  avatar                    :string,      // 群头像
  signature                 :string,      // 群公告
  qrcode                    :string,      // 群二维码
  qrcodeGenerateTime        :number,      // 二维码生成时间
  memberCount               :number,      // 群成员数量 
  serviceID                 :number,      // 服务id
  ctime?                    :number,      // 录入系统时间
  extra?                    :string,      // 扩展字段
  tags?                     :string       // 标签

}