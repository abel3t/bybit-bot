import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { binance } from 'ccxt';
import * as moment from 'moment';
import axios from 'axios';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class OkxService {
  buyCoinDate: Date | string;

  constructor() {
    const apiKey = process.env.OKX_API_KEY;
    const secretKey = process.env.OKX_SECRET_KEY;
    const password = process.env.OKX_PASSWORD;

    this.exchange = new binance({
      apiKey: apiKey,
      secret: secretKey,
      password: password,
      options: { defaultType: 'future' },
    });

    this.exchange.setSandboxMode(true);
  }

  exchange: any;

  placeOrder(params) {
    const timestamp = new Date().toISOString();
    const text =
      timestamp + 'POST' + '/api/v5/trade/order' + JSON.stringify(params);

    const sign = CryptoJS.enc.Base64.stringify(
      CryptoJS.HmacSHA256(text, process.env.OKX_SECRET_KEY),
    );

    console.log({
      'OK-ACCESS-KEY': process.env.OKX_API_KEY,
      text,
      'OK-ACCESS-PASSPHRASE': process.env.OKX_PASSWORD,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-SIGN': sign,
    });
    const BASE_URL = 'https://www.okx.com';
    return axios.post(BASE_URL + '/api/v5/trade/order', params, {
      headers: {
        'OK-ACCESS-KEY': process.env.OKX_API_KEY,
        // 'OK-ACCESS-PASSPHRASE': process.env.OKX_PASSWORD,
        'OK-ACCESS-TIMESTAMP': timestamp,
        // 'OK-ACCESS-SIGN': sign,
        contentType: 'application/json',
      } as any,
    });
  }

  getBalance() {
    return this.exchange
      .fetchBalance()
      .then((result) => result.total)
      .catch((error) => error);
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    const result = await this.exchange.fetchTicker(symbol);

    console.log(result, result.last);

    return result?.last || 0;
  }

  private logMessage(message, options?: any) {
    const timeStringNow = moment()
      .utcOffset('+0700')
      .format('HH:mm DD/MM/YYYY');

    console.log(timeStringNow, ':', message, options || '');
  }

  async byCoin(symbol: string, lotSize: number) {
    const currentPrice = await this.getCurrentPrice(symbol).catch((error) =>
      console.log(error),
    );

    if (!currentPrice) {
      throw new BadRequestException(`Can not fetch ${symbol} price!`);
    }

    const buySize = parseInt(process.env.BUY_SIZE) || 10;
    const actualAmount = parseFloat((buySize / currentPrice).toFixed(lotSize));

    const date = moment().startOf('day').format();
    // if (this.buyCoinDate === date) {
    //   console.log(`Bought ${symbol} at price: ${currentPrice} - ${date}`);
    //   return { isCreateOrder: false };
    // }

    this.buyCoinDate = date;
    if (process.env.IS_ACTIVE === 'true') {
      const sl = (currentPrice * (1 - 0.3 / 100)).toFixed(2);
      const tp = (currentPrice * (1 + 0.3 / 100)).toFixed(2);

      console.log({
        stopLossPrice: sl,
        takeProfitPrice: tp,
        triggerPrice: currentPrice,
      });
      const result = await this.exchange.createOrder(
        symbol,
        'market',
        'buy',
        0.001,
        // undefined,
        // {
        //   stopLossPrice: sl,
        //   takeProfitPrice: tp,
        //   triggerPrice: currentPrice
        // },
        // params,
      );

      return result;

      // await this.exchange.setLeverage(2, 'BTC/USDT', {'mgnMode': 'isolated', posSide: 'short'}, )
      // .catch(error => console.log(error))

      // return this.placeOrder({
      //   instId: symbol,
      //   tdMode: 'isolated',
      //   side: 'buy',
      //   posSide: 'long',
      //   ordType: 'market',
      //   sz: actualAmount,
      //   tpTriggerPx: tp.toString(),
      //   tpOrdPx: tp.toString(),
      //   slTriggerPx: sl.toString(),
      //   slOrdPx: sl.toString(),
      // });

      this.logMessage(
        `Buy ${symbol} at ${currentPrice}\nAmount: ${actualAmount}\n`,
      );

      // return result;
    }

    console.log('Just for test!!!');
    return { isCreateOrder: false };
  }

  async handleWebhook(symbol: string, key: string) {
    if (key !== process.env.BOT_SECRET_KEY) {
      throw new ForbiddenException('Forbidden');
    }

    const PriceSymbol = {
      BTCUSDT: 'BTC/USDT:USDT',
      ETHUSDT: 'ETH/USDT',
      BNBUSDT: 'BNB/USDT',
    };
    symbol = PriceSymbol[symbol];

    const lockedAmount = parseInt(process.env.LOCKED_SIZE) || 3;
    const buySize = parseInt(process.env.BUY_SIZE) || 10;
    const btcSymbol = 'BTC/USDT:USDT';
    const ethSymbol = 'ETH/USDT';
    const bnbSymbol = 'BNB/USDT';

    const { USDT: usdtBalance } = await this.getBalance();

    console.log(await this.getBalance());
    if (!usdtBalance) {
      throw new BadRequestException('Can not fetch the balance');
    }

    const totalUsdt = usdtBalance - lockedAmount;
    if (totalUsdt < buySize) {
      this.logMessage(`No USDT to buy ${symbol}`);
      return;
    }

    switch (symbol) {
      case btcSymbol: {
        return this.byCoin(btcSymbol, 4);
      }

      case ethSymbol: {
        return this.byCoin(ethSymbol, 3);
      }

      case bnbSymbol: {
        return this.byCoin(bnbSymbol, 3);
      }

      default:
        break;
    }

    this.logMessage('Wrong type');
  }
}
