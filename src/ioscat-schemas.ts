import { SSL_OP_DONT_INSERT_EMPTY_FRAGMENTS } from "constants";


/**
  type	integer
  文本,   1
  语音, 2
  图片, 3
  视频, 4
  名片, 5
  链接, 6
  红包, 7
  转账, 8
  地址, 11
  好友请求, 12
  动画,    13
  语音聊天, 14
  视频聊天, 15
  模板消息, 18
  通知, 10000
 */
export enum IosCatMessageType {
  Text              = 1,
  Voice             = 2,  
  Image             = 3,
  Video             = 4, 
  ShareCard         = 5,
  Link              = 6,
  LuckyMoney        = 7,
  Transfer          = 8,
  Location          = 11,
  FriendRequest     = 12, 
  Animation         = 13,
  VoiceChat         = 14,
  VideoChat         = 15,
  Template          = 18,
  Notify            = 10000
}


export interface IoscatMessageRawPayload {

  /** p2p message structure */

  // { payload:
  //   { profilePlatformUid: ,
  //     profileCustomID: dancewuli,
  //     platformUid: wxid_j76jk7muhgqz22,
  //     customID: lymbupy,
  //     direction: 2,
  //     messageType: 1,
  //     sessionType: 1,
  //     platformMsgType: 1,
  //     content: hello,
  //     revoke: 2,
  //     sendTime: 1531313602,
  //     snapshot: hello,
  //     serviceID: 13,
  //     platformMsgID: 144,
  //     deviceID: c08e89b931699b60c0551fa6d4a4343c55de183d },
  //  type: ON_IM_MESSAGE_RECEIVED }

  /** p2p message structure */

  /** G2G message structure */

  /********************recieve a message*******************************/
  // { payload:
  //   { profilePlatformUid: 'wxid_tdax1huk5hgs12',
  //     profileCustomID: 'dancewuli',
  //     platformUid: 'wxid_j76jk7muhgqz22',
  //     customID: 'lymbupy',
  //     platformGid: '12519001238@chatroom',
  //     direction: 1,
  //     messageType: 1,
  //     sessionType: 2,
  //     platformMsgType: 1,
  //     content: 'hello',
  //     revoke: 2,
  //     sendTime: 1531578621,
  //     snapshot: 'hello',
  //     serviceID: 13,
  //     platformMsgID: '107',
  //     deviceID: 'c08e89b931699b60c0551fa6d4a4343c55de183d' },
  //  type: 'ON_IM_MESSAGE_RECEIVED' }

  /********************send a message *******************************/
  // { payload:
  //   { profilePlatformUid: 'wxid_tdax1huk5hgs12',
  //     profileCustomID: 'dancewuli',
  //     platformGid: '12519001238@chatroom',
  //     direction: 2,
  //     messageType: 1,
  //     sessionType: 2,
  //     platformMsgType: 1,
  //     content: 'Hello',
  //     revoke: 2,
  //     sendTime: 1531578839,
  //     snapshot: 'Hello',
  //     serviceID: 13,
  //     platformMsgID: '108',
  //     deviceID: 'c08e89b931699b60c0551fa6d4a4343c55de183d' },
  //  type: 'ON_IM_MESSAGE_RECEIVED' }
  /** G2G message structure */

  id     : string,   // 消息ID
  payload: {
    profilePlatformUid      : string,       // 运营号平台Uid
    profileCustomID         : string,       // 运营号平台自定义ID(微信号)
    platformUid?            : string,       // 联系人平台Uid
    customID?               : string,       // 联系人平台自定义ID(微信号)
    platformGid?            : string,       // 平台群ID
    direction               : number,       // 方向,相对于运营号 1 收到， 2 发出
    messageType             : number,       // 消息类型
    sessionType             : number,       // 会话类型 P2P=1, G2G=2
    platformMsgType         : number,       // 平台消息类型
    content                 : string,       // 消息内容
    revoke                  : number,       // 是否撤销
    sendTime                : number,       // 消息实际发送时间
    snapshot                : string,       // 快照
    serviceID               : number,       // 服务ID
    platformMsgID           : string,       // 平台消息ID
    deviceID                : string        // 设备唯一ID e.g UDID IMEI
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

  /**
    * 系统分配ID
    */
   id: number;
   /**
   * 系统分配联系人ID
   */
   contactID: number;
   /**
   * 平台uid
   */
   platformUid: string;
   /**
   * 平台自定义ID
   */
   customID?: string;
   /**
   * 系统分配群ID
   */
   gid: number;
   /**
   * 平台群ID
   */
   platformGid: string;
   /**
   * 成员别名
   */
   alias?: string;
   /**
   * 成员来源
   */
   source?: string;
   /**
   * 服务id
   */
   serviceID: number;
   /**
   * 信息是否完整记录
   */
   loaded?: number;
   /**
   * 扩展字段
   */
   extra?: string;
   /**
   * 标签
   */
   tags?: string;
   /**
   * 数据库记录创建时间
   */
   ctime?: number;
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
  /**
    * 系统分配群ID
    */
   id: number,
   /**
   * 系统分配群主联系人ID
   */
   ownerContactID?: number,
   /**
   * 群主平台ID
   */
   ownerPlatformUid: string,
   /**
   * 群主自定义ID
   */
   ownerCustomID?: string,
   /**
   * 运营号系统分配联系人ID
   */
   profileContactID?: number,
   /**
   * 运营号平台Uid
   */
   profilePlatformUid: string,
   /**
   * 运营号平台自定义ID
   */
   profileCustomID?: string,
   /**
   * 群ID
   */
   platformGid: string,
   /**
   * 群名称
   */
   name: string,
   /**
   * 群头像
   */
   avatar: string,
   /**
   * 群公告
   */
   signature: string,
   /**
   * 群二维码
   */
   qrcode: string,
   /**
   * 二维码生成时间
   */
   qrcodeGenerateTime: number,
   /**
   * 录入系统时间
   */
   ctime: number,
   /**
   * 群成员数量
   */
   memberCount: number,
   /**
   * 服务id
   */
   serviceID: number,
   /**
   * 扩展字段
   */
   extra?: string,
   /**
   * 标签
   */
   tags?: string,
  memberIdList?             :string[]     // 群成员的ID
}