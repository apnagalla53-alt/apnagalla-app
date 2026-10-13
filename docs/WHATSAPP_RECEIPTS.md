# WhatsApp receipts and customer Udhar chats

Use **WhatsApp receipt** on Sale successful or Bill Details, or on an invoice in the customer Khata timeline. The app fetches the saved tenant-scoped bill, shows a message preview and preloads the customer's phone if available. Walk-in bills allow a manually entered phone.

The customer Khata **WhatsApp** button prepares an outstanding-balance message. Entering a different number affects only this send; it does not edit the customer record. Indian 10-digit mobiles receive the `91` country prefix once. International numbers require an explicit country code. Invalid numbers cannot produce a chat link.

Choose **Open WhatsApp**, review the recipient and tap Send there. The redirect uses WhatsApp's documented [click-to-chat](https://faq.whatsapp.com/5913398998672934) `wa.me` link with URL-encoded text. The recipient need not be saved in the phone's contacts. Opening a chat is not proof of sending, delivery or payment.

The text contains shop, bill/date/customer, item lines where available, billing payment split, paid/outstanding amounts and due date. Returns are identified as separate records; original billed amounts are not silently rewritten. Very long bills use a summary and request the detailed PDF. Auth tokens and private invoice URLs are never included.

Click-to-chat preloads text; it does not attach a PDF. For a full printed invoice, choose Print invoice, save as PDF and attach it manually in WhatsApp. No WhatsApp Business API account is required for this user-directed redirect. The future automated voice assistant has different provider requirements.

Browser acceptance intercepts WhatsApp destinations and sends no real messages. Android has an explicit safe `wa.me` external-intent bridge; actual native WhatsApp handoff remains a signed-device acceptance requirement.
