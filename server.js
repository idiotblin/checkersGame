const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server1 = http.createServer(app);
const server2 = http.createServer(app);

const wss1 = new WebSocket.Server({ server: server1 });
const wss2 = new WebSocket.Server({ server: server2 });

let clients1 = [];
let clients2 = [];

wss1.on('connection', (ws) => {
    clients1.push(ws);
    ws.on('message', (message) => {
        clients2.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
    ws.on('close', () => {
        clients1 = clients1.filter(client => client !== ws);
    });
});

wss2.on('connection', (ws) => {
    clients2.push(ws);
    ws.on('message', (message) => {
        clients1.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
    ws.on('close', () => {
        clients2 = clients2.filter(client => client !== ws);
    });
});

app.use(express.static('public'));

server1.listen(5500, () => {
    console.log('Server 1 is listening on port 5500');
});

server2.listen(5501, () => {
    console.log('Server 2 is listening on port 5501');
});
