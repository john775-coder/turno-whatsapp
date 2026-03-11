const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const http = require('http')

let sock

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    
    sock = makeWASocket({
        auth: state,
        logger: require('pino')({ level: 'silent' })
    })

    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update
        
        if (qr) {
            console.log('\n📱 Escaneá este QR:\n')
            qrcode.generate(qr, { small: true })
        }
        if (connection === 'close') connectToWhatsApp()
        if (connection === 'open') console.log('✅ WhatsApp conectado!')
    })

    sock.ev.on('creds.update', saveCreds)
}

// Servidor HTTP para recibir mensajes desde n8n
const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/send') {
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

server.listen(3000, () => console.log('🚀 Servidor en puerto 3000'))
connectToWhatsApp()