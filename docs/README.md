---
icon: hand-wave
layout:
  width: default
  title:
    visible: true
  description:
    visible: false
  tableOfContents:
    visible: true
  outline:
    visible: true
  pagination:
    visible: true
  metadata:
    visible: true
---

# About

## What is Check?

**Check** is a browser extension that provides real-time protection against Microsoft 365 phishing attacks.

Specifically designed for enterprises and managed service providers, Check uses sophisticated detection algorithms to identify and block malicious login pages before credentials can be stolen by bad actors.

Check is available for **Chrome**, **Microsoft Edge**, and **Firefox** (109+ <mark style="color:orange;">Coming Soon!</mark>).

The extension integrates seamlessly with existing security workflows, offering centralized management, comprehensive logging, and optional CIPP integration for MSPs managing multiple Microsoft 365 tenants.

Check is completely free and open source, can be delivered to users fully white-labeled, and is licensed under AGPL-3. You can contribute to Check at [https://github.com/cyberdrain/Check](https://github.com/cyberdrain/Check).

Installing the extension immediately gives you protection against AITM attacks and takes seconds. Click the install button and you're good to go.

<a href="https://microsoftedge.microsoft.com/addons/detail/check-by-cyberdrain/knepjpocdagponkonnbggpcnhnaikajg" class="button primary">Install for Edge</a> **OR** <a href="https://chromewebstore.google.com/detail/benimdeioplgkhanklclahllklceahbe" class="button primary">Install for Chrome</a> **OR** <a href="./" class="button secondary">Firefox (Coming Soon!)</a>

## Why was Check created?

Check was created out of a need for better protection against AITM attacks. During a CyberDrain brainstorming session, CyberDrain's lead developer came up with the idea to create a Chrome extension to protect users:

<figure><img src=".gitbook/assets/image.png" alt=""><figcaption></figcaption></figure>

This led to a hackathon in which the team crafted a proof of concept. This proof of concept led to the creation of Check by CyberDrain. CyberDrain decided to offer Check as a free-to-use community resource for everyone.

### What information does Check collect?

Nothing. We're not even kidding: we don't collect any data at all. You can set up a CIPP reporting server if you'd like, but it reports directly to your own environment. CyberDrain doesn't believe in making its users a product. We don't sell or collect any information.

## How does it look?

When the extension is added for a user, a new icon will appear. This icon is [brandable](settings/branding.md), allowing you to customize it with your own logo and name.

<figure><img src=".gitbook/assets/image (1).png" alt=""><figcaption></figcaption></figure>

When you visit a suspicious page but our certainty that it is phishing is too low, we'll show a banner to warn you. If we're sure that the page is an AITM or phishing attack, we'll block it entirely:

<figure><img src=".gitbook/assets/image (3).png" alt=""><figcaption></figcaption></figure>

This too is completely [brandable](settings/branding.md), and can be made to match company colours. The Contact Admin button is a mailto: link that contains the information about what page the user tried to visit, including a defanged URL.
