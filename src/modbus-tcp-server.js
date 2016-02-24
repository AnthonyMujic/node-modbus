var stampit             = require('stampit'),
    ModbusServerCore    = require('./modbus-server-core.js'),
    Put                 = require('put'),
    net                 = require('net');

module.exports = stampit()
    .compose(ModbusServerCore)
    .init(function () {
    
        var socket, server;

        var init = function () {
       
            if (!this.port) {
                this.port = 502;
            }

            if (!this.hostname) {
                this.hostname = '0.0.0.0';
            }

            server = net.createServer();
            
            server.on('connection', function (s) {

                this.log('new connection', s.address());
 
                initiateSocket(s);
           
            }.bind(this));

            server.listen(this.port, this.hostname, function (err) {
           
                if (err) {
                
                    this.log('error while listening', err);
                    this.emit('error', err);
                    return;

                }

            }.bind(this));
 
            this.log('server is listening on port', this.hostname + ':' + this.port);

        }.bind(this);

        var onSocketEnd = function (socket) {
        
            return function () {
            
                this.log('connection closed.');
            
            }.bind(this);
        
        }.bind(this);

        var onSocketData = function (socket) {
        
            return function (data) {

                this.log('received data');

                // 1. extract mbap

                var mbap    = data.slice(0, 0 + 7),
                    len     = mbap.readUInt16BE(4);
                    request = { 
                        trans_id: mbap.readUInt16BE(0),
                        protocol_ver: mbap.readUInt16BE(2),
                        unit_id: mbap.readUInt8(6) 
                    }; 

                this.log('MBAP extracted');

                // 2. extract pdu

                var pdu = data.slice(7, 7 + len - 1);

                this.log('PDU extracted');

                // emit data event and let the 
                // listener handle the pdu

                this.emit('data', pdu, function (response) {
                
                     var pkt = Put()
                        .word16be(mbap.trans_id)        // transaction id
                        .word16be(mbap.protocol_ver)    // protocol version
                        .word16be(response.length + 1)  // pdu length
                        .word8(mbap.unit_id)            // unit id
                        .put(response)                  // the actual pdu
                        .buffer();

                    socket.write(pkt);

                }.bind(this)); 
            
            }.bind(this);
        
        }.bind(this);

        var initiateSocket = function (socket) {
        
            socket.on('end', onSocketEnd(socket));
            socket.on('data', onSocketData(socket));
        
        }.bind(this);    


        init();
    
    
    });