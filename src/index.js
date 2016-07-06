"use strict";

const net = require("net");
const log = function() {
  console.log.apply(console, arguments);
};

const EVENTS = {
  HANDSHAKE: "handshake",
  PROXY_CONNECT: "proxyConnect",
  PROXY_DATA: "proxyData",
  PROXY_END: "proxyEnd",
  PROXY_ERROR: "proxyError"
};

//socks5   参见RFC_1928
const SOCKS5 = {
  VERSION: 0x05,

  //ATYP  地址类型
  IPV4: 0x01,
  DOMAINNAME: 0x03,
  IPV6: 0x04,

  //命令
  CONNECT : 0x01,
  BIND : 0x02,
  UDP_ASSOCIATE : 0x03,

  //认证方法
  NO_AUTHENTICATION_REQUIRED : 0x00,
  GSSAPI : 0x01,
  BASIC_AUTHENTICATION : 0x02,
  NO_ACCEPTABLE_METHODS : 0xff,

  //信号
  SUCCEEDED : 0x00,
  GENERAL_FAILURE : 0x01,
  CONNECTION_NOT_ALLOWED : 0x02,
  NETWORK_UNREACHABLE : 0x03,
  HOST_UNREACHABLE : 0x04,
  CONNECTION_REFUSED : 0x05,
  TTL_EXPIRED : 0x06,
  COMMAND_NOT_SUPPORTED : 0x07,
  ADDRESS_TYPE_NOT_SUPPORTED : 0x08
};

module.exports = (function(self) {
  self.liveSessions = [];
  self.options = {};
  self.server = null;

  function Session(clientSocket) {

    function connect(buffer) {
      const version = buffer[0];
      const command = buffer[1];
      const atyp = buffer[3];
      let address, port;

      self.liveSessions.push(clientSocket);
      if (atyp === SOCKS5.IPV4) {
        address = [].slice.call(buffer, 4, 8).join(".");
        port = [].slice.call(buffer, 8, 10);
        let high = port[0].toString(16), low = port[1].toString(16);
        port = parseInt(`0x${high}${low}`, 10);
      } else if (atyp === SOCKS5.DOMAINNAME) {

      }

      if (command === SOCKS5.CONNECT) {
        let target = net.createConnection(
          port,
          address,
          () => {
            let responseBuffer = new Buffer(buffer);
            responseBuffer[1] = SOCKS5.SUCCEEDED;

            clientSocket.write(responseBuffer, () => {
              target.pipe(clientSocket);
              clientSocket.pipe(target);
            });
          }
        );

        target.on("connect", () => {
          let info = {
            host: address,
            port: port
          };

          self.server.emit(EVENTS.PROXY_CONNECT, info, target);

          target.on("data", data => {
            self.server.emit(EVENTS.PROXY_DATA, data);
          });
        });

        target.on("error", err => {
          err.host = address;
          err.port = port;
          err.atyp = atyp;

          self.server.emit(EVENTS.PROXY_ERROR, err);

          return end(SOCKS5.NETWORK_UNREACHABLE, buffer);
        });

      } else {
        return end(SOCKS5.SUCCEEDED, buffer);
      }
    }

    function end(response) {
      let responseBuffer = new Buffer([
        SOCKS5.VERSION,
        response
      ]);

      try {
        clientSocket.end(responseBuffer);
      } catch (e) {
        clientSocket.destroy();
      }

      self.server.emit(EVENTS.PROXY_END, response);
    }

    function handshake(buffer) {
      const version = buffer[0];
      let responseBuffer = [
        SOCKS5.VERSION,
        SOCKS5.NO_AUTHENTICATION_REQUIRED
      ];
      responseBuffer = new Buffer(responseBuffer);

      clientSocket.write(responseBuffer, () => {
        self.server.emit(EVENTS.HANDSHAKE, clientSocket);
        clientSocket.once("data", connect);
      });
    }

    clientSocket.once("data", handshake);

    clientSocket.once("end", () => {
      self.liveSessions.splice(self.liveSessions.indexOf(clientSocket), 1);
    });
  }


  self.createServer = options => {
    self.server = net.createServer(Session);
    return self.server;
  };

  return self;
})({});
