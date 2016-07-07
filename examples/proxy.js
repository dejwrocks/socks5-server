"use strict";

const socks5 = require('../lib'),
const log = function() {
	console.log.apply(console, arguments);
};
const	server = socks5.createServer();
const PORT = 5245;

server.on("handshake", function (clientSocket) {
	log();
	log('------------------------------------------------------------');
	log('accept socks5 client from %s:%d', clientSocket.remoteAddress, clientSocket.remotePort);
	log('------------------------------------------------------------');
});

//为客户端搭理请求时
server.on('proxyConnect', function (info, destination) {
	log('connected to remote server at %s:%d', info.host, info.port);

	destination.on('data', function (data) {
		log(data.length);
	});
});

//代理请求的数据
server.on('proxyData', function (data) {
	log(data.length);
});

//代理请求时发生错误
server.on('proxyError', function (err) {
	console.error('unable to connect to remote server');
	console.error(err);
});

// When a proxy connection ends
server.on('proxyEnd', function (response, args) {
	log('socket closed with code %d', response);
	log(args);
	log();
});

server.listen(PORT);
log(`listening at ${PORT}...`);
