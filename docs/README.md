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

**Check** is a browser extension that provides real-time protection against Microsoft 365 phishing attacks.&#x20;

Specifically designed for enterprises and managed service providers, Check uses sophisticated detection algorithms to identify and block malicious login pages before credentials can be stolen by bad actors.

Check is available for **Chrome**, **Microsoft Edge**, and **Firefox** (109+).

The extension integrates seamlessly with existing security workflows, offering centralized management, comprehensive logging, and offers an optional CIPP integration for MSPs managing multiple Microsoft 365 tenants.&#x20;

Check is completely free, open source, and can be delivered to users completely white-label, it is an open source project licensed under AGPL-3. You can contribute to check at [https://github.com/cyberdrain/Check](https://github.com/cyberdrain/Check).&#x20;

Installing the plugin immediately gives you protection against AITM attacks, and takes seconds. Click the install button and you're good to go.

<a href="https://microsoftedge.microsoft.com/addons/detail/check-by-cyberdrain/knepjpocdagponkonnbggpcnhnaikajg" class="button primary">Install for Edge</a> **OR**  <a href="https://chromewebstore.google.com/detail/benimdeioplgkhanklclahllklceahbe" class="button primary">Install for Chrome</a>

**Firefox users:** See the [Firefox Support](firefox-support.md) guide for installation instructions.

## Why was Check created?

Check was created out of a need to have better protection against AITM attacks. During a CyberDrain brainstorming session CyberDrain's lead dev came up with the idea to create a Chrome extension to protect users:

<figure><img src=".gitbook/assets/image.png" alt=""><figcaption></figcaption></figure>

This led to a hackathon in which the team crafted a proof of concept. This proof of concept led to the creation of Check by CyberDrain. CyberDrain decided to offer Check as a free to use community resource, for everyone.



### What information does Check collect?

Nothing. We're not even kidding, we don't collect any data at all. You can set up a CIPP reporting server if you'd like, but this reports directly to your own environment. CyberDrain doesn't believe in making their users a product. We don't sell or collect any information.



## How does it look?

When a user gets the plugin added, a new icon will appear, this icon is [brandable](settings/branding.md) to customize it to your own logo and name.

<figure><img src=".gitbook/assets/image (1).png" alt=""><figcaption></figcaption></figure>

When visiting a page that is suspect, but our certainty if the page is phishing is too low we'll show a banner on the page to warn users, if we're sure about the page being an AITM or phishing attack, we'll block the page entirely:

<figure><img src=".gitbook/assets/image (3).png" alt=""><figcaption></figcaption></figure>

This too is completely [brandable](settings/branding.md), and can be made to match company colours. The Contact Admin button is a mailto: link that contains the information about what page the user tried to visit, including a defanged URL.
