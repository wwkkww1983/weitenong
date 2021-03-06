const KEY_YIJIA = [0x3A, 0x60, 0x43, 0x2A, 0x5C, 0x01, 0x21, 0x1F, 0x29, 0x1E, 0x0F, 0x4E, 0x0C, 0x13, 0x28, 0x25];
const KEY_ASDD = [0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46];

const BLUETIMEOUT = 5000;

const DIRECTIVE = {
  yijia: {
    token: ['0x06', '0x01', '0x01', '0x01'],
    open: ['0x05', '0x01', '0x06'],
    close: []
  },
  asdd: {
    open: 'UL057385',
    close: []
  }
}

module.exports = {
  KEY_YIJIA,
  KEY_ASDD,
  BLUETIMEOUT,
  DIRECTIVE
}