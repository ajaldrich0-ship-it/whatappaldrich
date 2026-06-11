# WhatsApp Bot — Node.js

A WhatsApp automation bot built with `whatsapp-web.js`. Send messages, auto-reply, and do bulk messaging using your personal WhatsApp account.

---

## Requirements

- Node.js v16 or higher
- Google Chrome or Chromium installed
- A WhatsApp account on your phone

---

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your target number and message
   ```

3. **Run any script** (see below)

---

## Scripts

### Auto-Reply Bot
Listens for incoming messages and auto-replies based on keywords.

```bash
npm start
```

Responds to: `hi`, `hello`, `help`, `ping`, `time`

---

### Send a Single Message
Send one message to a specific number.

```bash
# Edit TARGET_NUMBER and DEFAULT_MESSAGE in .env, then:
npm run send

# Or edit src/send-message.js directly
```

---

### Bulk Sender
Send messages to multiple contacts with a delay between each.

```bash
# Edit the CONTACTS array in src/bulk-sender.js, then:
npm run bulk
```

---

### Send Image/File
Send an image, PDF, or any file.

```bash
# Put your file in ./media/ folder
# Edit MEDIA_PATH and TO_NUMBER in src/send-media.js, then:
node src/send-media.js
```

---

## First Run — QR Code

On first run, a QR code will appear in the terminal. Scan it with your phone:

1. Open WhatsApp on your phone
2. Go to **Settings → Linked Devices → Link a Device**
3. Scan the QR code in the terminal

Your session is saved in the `./session` folder. You won't need to scan again unless you log out.

---

## Phone Number Format

Numbers must include the country code with **no `+`, spaces, or dashes**.

| Country | Your Number | Format to use |
|---------|-------------|---------------|
| India   | +91 98765 43210 | `919876543210` |
| US      | +1 555-123-4567 | `15551234567`  |
| UK      | +44 7911 123456 | `447911123456` |

---

## Folder Structure

```
whatsapp-bot/
├── src/
│   ├── index.js          # Auto-reply bot
│   ├── send-message.js   # Send single message
│   ├── bulk-sender.js    # Bulk messaging
│   └── send-media.js     # Send image/file
├── media/                # Put files to send here
├── session/              # Auto-created, stores auth session
├── .env.example          # Config template
├── package.json
└── README.md
```

---

## ⚠️ Important Notes

- This uses your **personal WhatsApp number** — not the official Business API
- Do **not** spam or send bulk unsolicited messages — WhatsApp may ban your number
- For production/commercial use, consider the [official WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- The `session/` folder contains your login — keep it private and don't share it

---

## Troubleshooting

**QR code not showing?**  
Make sure Chrome/Chromium is installed on your system.

**"Session expired" error?**  
Delete the `./session` folder and run again to rescan.

**Message not delivered?**  
- Check the number format (country code, no spaces)
- Make sure the recipient has WhatsApp installed
