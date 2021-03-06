// pages/input/input.js
let http          = require('../../http/request')
let api           = require('../../http/api')
let utils         = require('../../utils/util')
let config        = require('../../utils/config')
let cryptoService = require('../../utils/cryptoService')
let pay           = require('../../utils/pay')

Page({
  /**
   * 页面的初始数据
   */
  data: {
    code     : '',
    bindData : {},
    openKey  : [],
    focus    : true,
    isInit   : false,   //是否初始化
    isConnect: false,   //是否连接上
    yjtoken  : [],
    sys      : '',      // 手机系统,区分ios和andriod
    firm     : 0        // 设备厂家 1.asdd  2.yj
  },
  onChange(e) {
    this.setData({ code: e.detail });
  },
  openBtn() {// 前台开锁按钮
    let isInit = this.data.isInit;
    // 不能重复初始化蓝牙,否则会出错
    if(isInit) {
      this.httpcon();
    }else {
      this.init().then((res) => {
        this.getBluetoothAdapterState();
        this.setData({isInit: true})
      }, (err) => { // 初始化失败
        console.log(err);
        wx.showLoading({
          title   : '请开蓝牙',
          icon    : 'loading',
          duration: 2000
        })
      });
    }
  },
  // 开锁业务逻辑
  httpcon() {
    let that = this,
        code = this.data.code;
    // 判断用户身份 express/user_type
    http.request('POST', api.ApiExpressUserype, { code: code }).then(res => {
      if (res.error_code === 0) { // 如果是业主
        // 业主下单 express/save
        http.request('GET', api.ApiExpressSave, {code}).then(res => {
          if (res.error_code === 0) {
            let did = res.data.did
            // 业主开锁 express/user_unlock
            http.request('POST', api.ApiExpressUserLock, { did, code: code }).then(res => {
              if (res.error_code === 0) {  // 可以开锁
                //开锁后回调
                http.request('POST', api.Api.express.user_success, {did, status: 1}).then(res => {

                })
                let bindData = res.data;
                console.log('bindData: ', bindData);
                that.setData({ bindData, firm: res.data.id })
                that.diffSys();
              }else {
                wx.showToast({
                  title: '没有该设备',
                  icon : 'none'
                })
              }
            })
          }else if(res.error_code === 1) {
            wx.showToast({
              title: res.msg,
              icon : 'none'
            })
          }
        })
      }else if(res.error_code === 1) { // 如果是快递员或其它人
        // 其他人下单 express/other_save
        http.request('GET', api.ApiExpressOtherSave, { code }).then(res => {
          if (res.error_code === 0) {
            let did = res.data.did
            // 判断订单是否支付 express/jugde_dd
            http.request('GET', api.ApiExpressJugdeDd + '?did=' + did).then(res => {
              if (res.error_code === 0) {
                // 其他人开锁 express/other_unlock
                http.request('POST', api.ApiExpressOtherUnlock, { did, code }).then(res => {
                  
                  if (res.error_code !== 0) {
                    wx.showToast({
                      title: res.msg,
                      icon : 'none'
                    })
                    return;
                  }
                  //开锁后回调
                  http.request('POST', api.Api.express.other_success, {did, status: 1}).then(res => {
                    
                  })
                  let bindData = res.data;
                  that.setData({ bindData, firm: res.data.id })
                  that.diffSys();
                })
              }else if (res.error_code === 1) {
                // 微信支付 pay/pays_order?did=4
                http.request('GET', api.Api.default.pay, { did }).then(res => {
                  pay.pay(res).then(res => {
                    // 其他人开锁 express/other_unlock
                    http.request('POST', api.ApiExpressOtherUnlock, { did, code }).then(res => {
                      if(res.error_code === 0) {
                        let bindData = res.data;
                        that.setData({ bindData, firm: res.data.id })
                        that.diffSys();
                        //开锁后回调
                        http.request('POST', api.Api.express.other_success, {did, status: 1}).then(res => {
                          
                        })
                      }else {
                        wx.showToast({
                          title: res.msg,
                          icon : 'none'
                        })
                        return
                      }
                    })
                  })
                })
              }
            })
          }else if(res.error_code === 1) {
            wx.showToast({
              title: res.msg,
              icon : 'none'
            })
          }
        })
      }else if(res.error_code === 503) {
        wx.showToast({
          title: res.msg,
          icon : 'none'
        })
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/bindPhone/bindPhone'
          })
        }, 2000)
      }
    })
  },
  // 初始化wx蓝牙模块
  init() {
    // 如果希望用户在最新版本的客户端上体验您的小程序，可以这样子提示
    if (!wx.openBluetoothAdapter) {
      wx.showModal({
        title  : '提示',
        content: '当前微信版本过低，无法使用该功能，请升级到最新微信版本后重试。'
      })
      return;
    }
    return new Promise(function(reject, resolve) {
      wx.openBluetoothAdapter({
        success(res) {
          reject(res);
          // that.getBluetoothAdapterState();
        },
        fail(err) {
          resolve(err);
        }
      })
    })
  },
  // 获取本机蓝牙适配器状态。
  getBluetoothAdapterState() {
    let that = this;
    wx.getBluetoothAdapterState({
      success(res) {
        let { available, discovering } = res;
        if(!available) {
          wx.showToast({
            title: '请开启手机蓝牙再试',
            icon : 'none'
          })
          return;
        }
        that.httpcon();
        // wx.onBluetoothAdapterStateChange(function(res) {
        //   if(res.available) {
        //     that.init()
        //   }
        // });
      },
      fail(err) {
        console.log(err);
      }
    });
  },
  // 区分手机系统
  diffSys() {
    let sys = this.data.sys;
    /*
      ios和安卓的区别
      安卓不需要匹配直接连接,ios需要先蓝牙匹配
      在连接后要不要再次获取设备id 和 服务uuid
    */
    // if (sys === 'ios') {
    //   this.iosPhone();
    // }else if(sys === 'android') {
    //   this.androidPhone();
    // }
    this.iosPhone();
  },
  iosPhone() {
    /*
      ios
      需要搜索匹配
      需要解析id
    */
    this.startBluetoothDevicesDiscovery();
  },
  // 安卓手机
  androidPhone() {
    let bindData  = this.data.bindData,
        isConnect = this.data.isConnect;
    if(isConnect) {
        this.notifyBLECharacteristicValueChange(bindData.deviceId, bindData.serviceId, bindData.readId);
    }else {
      this.connectTO(bindData.deviceId, bindData.serviceId, bindData.readId);
    }
  },
  startBluetoothDevicesDiscovery() {
    let that = this;
    wx.startBluetoothDevicesDiscovery({
      services: ['FFF0', 'FEE7'],   // 过滤其他设备
      success : function (res) {
        that.onBluetoothDeviceFound();
      }
    })
  },
  // 监听寻找到新设备的事件
  onBluetoothDeviceFound() {
    let that     = this,
        bindData = this.data.bindData,
        sys = this.data.sys,
        firm     = this.data.firm;

    wx.onBluetoothDeviceFound(function(res) {
      let advertisData = null;  //ios下通过设备advertisData获取设备id
      
      res.devices.forEach(item => {
        if(item.advertisData) {
          advertisData = utils.arrayBufferToHexString(item.advertisData)
          var mac = advertisData.slice(2,8).join(':').toUpperCase()
          var codeArr = advertisData.slice(8, 21);
          var code = ''
          
          // ascii编码
          codeArr.forEach(item => {
            code += String.fromCharCode('0x' + item)
          })
          
          if(bindData.code === code) {
            bindData.deviceId = mac
            that.setData({
              bindData
            })
            if(sys === 'ios') {
              that.connectTO(item.deviceId, bindData.serviceId, bindData.readId);
            }else if(sys === 'android') {
              that.connectTO(mac, bindData.serviceId, bindData.readId);
            }
            wx.stopBluetoothDevicesDiscovery();
          }
        }
      })
      
        

        // if(firm === 1) {
          
        // }else if(firm === 2) {
        //   advertisData = utils.ab2hex(new Uint8Array(item.advertisData, 0)).slice(2).join(':').toUpperCase();
        //   if(bindData.deviceId === advertisData) {
        //     bindData.deviceId = item.deviceId;
        //     that.setData({ bindData })
        //     that.connectTO(item.deviceId, bindData.serviceId, bindData.readId);
        //     wx.stopBluetoothDevicesDiscovery();
        //   }
        // }
      
    });

    // 超时后,自动关闭 
    setTimeout(() => {
      wx.stopBluetoothDevicesDiscovery() 
    }, config.BLUETIMEOUT);
  },
  // 获取连接设备的service服务uuid
  getBLEDeviceServices: function (deviceId) {
    let that = this;

    wx.getBLEDeviceServices({
      deviceId: deviceId,
      success : function (res) {
        let serviceId = res.services[0].uuid;
        that.getBLEDeviceCharacteristics(deviceId, serviceId);
      }
    })
  },
  //获取连接设备的所有特征值  for循环获取不到值
  getBLEDeviceCharacteristics: function (deviceId, serviceId) {
    var that = this,
        firm = this.data.firm;

    wx.getBLEDeviceCharacteristics({
      // 这里的 deviceId 需要在上面的 getBluetoothDevices 或 onBluetoothDeviceFound 接口中获取
      deviceId: deviceId,
      // 这里的 serviceId 需要在上面的 getBLEDeviceServices 接口中获取
      serviceId: serviceId,
      success  : function (res) {
        if(firm === 1) {
          that.notifyBLECharacteristicValueChange(deviceId, serviceId, res.characteristics[0].uuid)
        }else if(firm === 2) {
          that.notifyBLECharacteristicValueChange(deviceId, serviceId, res.characteristics[1].uuid)
        }
      }
    })
  },
  // (宜家加密数据)
  yijiaProcessing(sData) {
    /*
      宜家锁收发数据js中为16位数据,可以为字符串,不影响结果
      向蓝牙锁写入分2步: 
      1. 处理指令
      2. 加密
    */
    let sendData = null,
        len      = 16 - sData.length;
    // 1处理指令
    for(let i = 0; i < len; i++) {
      sData.push('0x30')
    }
    // 2加密
    let bData = cryptoService.encrypt(sData, config.KEY_YIJIA).map(item => {
      return '0x' + item.toString(16).toUpperCase()
    })

    // 转换为ArrayBuffer
    let enDataBuf = new Uint8Array(bData);
        sendData  = enDataBuf.buffer;
    return sendData;// 返回处理数据
  },
  getYjToken() {
    let bindData = this.data.bindData,
        sendData = null,
        that     = this,
        yjtoken  = this.data.yjtoken;

    // 先开启写入端口
    wx.notifyBLECharacteristicValueChange({
      state           : true,
      deviceId        : bindData.deviceId,
      serviceId       : bindData.serviceId,
      characteristicId: bindData.readId,
      success(res) {
        // 获取Token
        sendData = that.yijiaProcessing(config.DIRECTIVE.yijia.token);
        console.log('sendData: ', sendData);

        wx.onBLECharacteristicValueChange(function (characteristic){
          if (characteristic.characteristicId.toLowerCase().indexOf("36f6") != -1) {
            let char6value = new Uint8Array(characteristic.value, 0);
            // 转化响应数据
            let lockData = utils.ab2hexyj(char6value);
            // 解密
            lockData = cryptoService.decrypt(lockData, config.KEY_YIJIA).map(item => {
              return '0x' + item.toString(16).toUpperCase()
            });
            var token = [lockData[3], lockData[4], lockData[5],lockData[6]];
            if(!yjtoken.length) {
              that.setData({ yjtoken: token });
            }
          }
        });

        wx.writeBLECharacteristicValue({
          deviceId        : bindData.deviceId,
          serviceId       : bindData.serviceId,
          characteristicId: bindData.writeId,
          value           : sendData,
          success(res) {
            console.log('token获取成功',res);
            that.openYj();
          },
          fail(err) {
            console.log('token获取失败',err);
          }
        })
      },
      fail(err){
        console.log(err);
        wx.showToast({
          title: 'notify接口开启失败',
          icon : 'none'
        })
      }
    })
  },
  openYj() {
    let pass  = ['0x30', '0x30', '0x30', '0x30', '0x30', '0x30'],
        token = this.data.yjtoken;
        console.log('存储token: ', token);
    
        pass = config.DIRECTIVE.yijia.open.concat(pass).concat(token);

        if(token) {
          this.writeBLECharacteristicValue(pass)
        }else {
          wx.showToast({
            title: '请先获取token',
            icon : 'none'
          })
        }
  },
  writeBLECharacteristicValue(sData, btRandrom) {
    console.log('执行writeBLECharacteristicValue');
    
    let firm     = this.data.firm,
        bindData = this.data.bindData,
        sendData = null,
        that     = this;
      sendData = this.asddLock(sData, btRandrom)
    // if(firm === 1) {
    // }else {
    //   sendData = this.yijiaProcessing(sData)
    // }

    //TODO: 封装写入函数
    wx.writeBLECharacteristicValue({
      deviceId        : bindData.deviceId,
      serviceId       : bindData.serviceId,
      characteristicId: bindData.writeId,
      value           : sendData,
      success(res) {
        console.log('写入成功',res);
        that.setData({ isConnect: true });
      },
      fail(err) {
        // 10007 当前特征值不支持此操作
        console.log('写入失败',err);
      }
    })
  },
  // 连接设备
  connectTO: function (deviceId, serviceId, characteristicId) {
    console.log('deviceId: ', deviceId);
    let that = this,
        sys  = this.data.sys;
    wx.createBLEConnection({
      deviceId: deviceId,
      success : function (res) {
        that.setData({
          isConnect: true
        })
        console.log('sys: ', sys);
        if(sys === 'ios') {
          // 获取服务id
          that.getBLEDeviceServices(deviceId)
        }else if(sys === 'android') {
          // // 获取服务id
          // that.getYjToken()
          that.notifyBLECharacteristicValueChange(deviceId, serviceId, characteristicId)
        }
      },
      fail: function (err) {
        console.log('err: ', err);
        wx.showToast({
          title: '连接设备失败',
          icon : 'none'
        })
      },
      complete: function () {}
    })
  },
  // 启用低功耗蓝牙设备特征值变化时的 notify 功能
  notifyBLECharacteristicValueChange(deviceId, serviceId, characteristicId) {
    let that = this,
        firm = this.data.firm;  //厂家
    if(firm === 1) {
      wx.notifyBLECharacteristicValueChange({
        state           : true,
        deviceId        : deviceId,
        serviceId       : serviceId,
        characteristicId: characteristicId,
        complete(res) {
          wx.onBLECharacteristicValueChange(function (characteristic) {
            if (characteristic.characteristicId.toLowerCase().indexOf("fff6") != -1) {
              var char6value = new Uint8Array(characteristic.value, 0);
              var tmp        = "";
                  tmp        = String.fromCharCode.apply(String, char6value);
  
              if (tmp.substring(0, 3) == 'KEY') 
              { 
                let btRandrom = char6value.subarray(3);
                that.asddopen(config.DIRECTIVE.asdd.open, btRandrom, deviceId, serviceId, characteristicId);
              }else {
                if (tmp.toUpperCase() == "UNLOCK") {
                  //开锁成功
                  http.request('GET', api.Api.express.unlock, { did: did, status: 1 }).then(res => {

                  })
                } else {
                  //开锁失败
                }
              }
            }
          })
        },
        fail(err){
          wx.showToast({
            title: 'notify接口开启失败',
            icon : 'none'
          })
        }
      })
    }else if(firm === 2) {// 宜家
      that.getYjToken();
    }
  },
  /* 
    asdd厂家开锁逻辑
  */
 asddLock(sData, btRandrom) {
  let sendData = null;

  if (btRandrom) {
    let cryptoKey = new Uint8Array(config.KEY_ASDD);
    for (let i = 0; i < btRandrom.length; i++) {
      cryptoKey[i] = btRandrom[i];
    }

    let bData     = cryptoService.encrypt(sData, cryptoKey);
    let enDataBuf = new Uint8Array(bData);
        sendData  = enDataBuf.buffer;
  }
  return sendData;
},
asddopen(sData, btRandrom, deviceId, serviceId, writeId) {
  let sendData = this.asddLock(sData, btRandrom),
  that = this;
  wx.writeBLECharacteristicValue({
    deviceId        : deviceId,
    serviceId       : serviceId,
    characteristicId: writeId,
    value           : sendData,
    success(res) {
      console.log('写入成功',res);
      that.setData({ isConnect: true });
    },
    fail(err) {
      // 10007 当前特征值不支持此操作
      console.log('写入失败',err);
    }
  })
},
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (e) {
    let code = e.code;
    if(code) {
      this.setData({
        code : code,
        focus: false
      })
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    let sys = wx.getSystemInfoSync();
    this.setData({ sys: sys.platform });
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})