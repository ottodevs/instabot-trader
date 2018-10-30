# Instabot Trader

A simple tool to convert text messages sent over HTTP or via a Telegram bot into
a set of trading orders, to a variety of exchanges (Bitfinex, Deribit and Coinbase Pro).

Use it automate placing orders, place a series of orders (eg, buy, take profit and stop loss)
or take advantage of advanced orders (like scaled orders, or stepped market orders) on
exchanges that don't support them. Chain together sequences of orders or order across multiple
exchanges on a single alert (long spot on Bitfinex and hedge with a short on Deribit).

It supports notifications to SMS, Telegram or Slack too, so you can use it as a super powerful
alerting tool to keep you in the loop. 

Docs are at [http://instabot42.github.io/](http://instabot42.github.io/)

Find me on [Whalepool.io](http://whalepool.io/) teamspeak

## Basic setup

Really, go look at the proper docs at [http://instabot42.github.io/](http://instabot42.github.io/).

You'll need `node` and `npm` to use this.

Clone the repo, then...

```bash
cd instabot-trader
npm install
npm run setup
```

Now edit the `config/local.json` file to get things ready (again - look at the docs).

And finally, to start the app running...

```bash
npm run start
```

To run the tests (either once, or continuously)...

```bash
npm run test
npm run watch
```

## All donations gratefully accepted! 

If you're using this to help you trade 24/7, it would be great if you could throw me a few Satoshi 
from time to time to say thanks. 

* Bitcoin: 39vBjyAu65vYEd7thnW75V7eULTcz7wgxV
* Litecoin: LUov5izfzuDakBeLGGCtyzmZcwCB2nXBDY
* Eth: 0x2F18958381D3a1025e136b5AEF727dDa132602f8
 
Thanks!


## License

Copyright 2018 Instabot

Permission is hereby granted, free of charge, to any person obtaining a copy of 
this software and associated documentation files (the "Software"), to deal in the 
Software without restriction, including without limitation the rights to use, copy, 
modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, 
and to permit persons to whom the Software is furnished to do so, subject to the 
following conditions:

The above copyright notice and this permission notice shall be included in all 
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A 
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT 
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION 
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
