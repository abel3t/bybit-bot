import { Injectable } from '@nestjs/common';
import { binance } from 'ccxt';
import moment from 'moment';

@Injectable()
export class AppService {
  constructor() {
    const apiKey = process.env.API_KEY;
    const secretKey = process.env.SECRET_KEY;

    this.exchange = new binance({
      apiKey: apiKey,
      secret: secretKey,
    });
    this.exchange.setSandboxMode(true);

    console.log({
      key: apiKey,
      secret: secretKey,
    });
  }

  exchange: any;

  async getBalance() {
    const result = await this.exchange.fetchBalance();

    return result.total;
  }

  private async getCurrentPrice() {
    const result = await this.exchange.fetchLastPrices(['BNBUSDT']);

    return result['BNB/USDT']?.price;
  }

  async handleWebhook(type: string) {
    const currentBnbPrice = await this.getCurrentPrice();
    const lockedAmount = 3;
    const lotSize = 0.001;

    const { BNB: bnbBalance, USDT: usdtBalance } = await this.getBalance();

    return this.getBalance();

    if (type === 'buy') {
      console.log(
        moment().format() + ': ' + 'Buy BNB at price',
        currentBnbPrice,
      );

      const bnbAmount = (usdtBalance - lockedAmount) / currentBnbPrice;

      return this.exchange.createOrder(
        'BNBUSDT',
        'market',
        'buy',
        Math.floor(bnbAmount / lotSize) * lotSize,
      );
    }

    if (type === 'sell') {
      const adjustedQuantity = Math.floor(bnbBalance / lotSize) * lotSize;

      console.log(
        moment().format() + ': ' + 'Sell BNB at price',
        currentBnbPrice,
      );

      return this.exchange.createOrder(
        'BNBUSDT',
        'market',
        'sell',
        adjustedQuantity,
      );
    }

    console.log('wrong type');
  }
}
