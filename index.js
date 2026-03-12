process.on('uncaughtException', (err) => {
    console.error('ERROR:', err)
    process.exit(1)
})

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const http = require('http')

let sock
let lastQR = ''

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    
    sock = makeWASocket({
        auth: state,
        logger: require('pino')({ level: 'silent' })
    })

    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update
        
        if (qr) {
            lastQR = qr
            console.log('QR actualizado, abrí /qr en el navegador')
        }
        if (connection === 'close') connectToWhatsApp()
        if (connection === 'open') {
            lastQR = ''
            console.log('✅ WhatsApp conectado!')
        }
    })

    sock.ev.on('creds.update', saveCreds)
}

const server = http.createServer(async (req, res) => {
    if (req.url === '/qr') {
        if (lastQR) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(`<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#000">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(lastQR)}" />
                </body></html>`)
        } else {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end('<html><body style="color:white;background:#000;display:flex;justify-content:center;align-items:center;height:100vh"><h1>✅ WhatsApp ya conectado!</h1></body></html>')
        }
    } else if (req.method === 'POST' && req.url === '/send') {
        let body = ''
        req.on('data', chunk => body += chunk)
        req.on('end', async () => {
            try {
                const { phone, message } = JSON.parse(body)
                const jid = phone.replace(/\D/g, '') + '@s.whatsapp.net'
                await sock.sendMessage(jid, { text: message })
                res.writeHead(200)
                res.end(JSON.stringify({ status: 'sent' }))
            } catch (e) {
                res.writeHead(500)
                res.end(JSON.stringify({ error: e.message }))
            }
        })
    } else {
        res.writeHead(200)
        res.end(JSON.stringify({ status: 'ok' }))
    }
})

server.listen(process.env.PORT || 3000, () => console.log('🚀 Servidor listo'))
connectToWhatsApp()
