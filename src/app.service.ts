import { BadRequestException, Injectable } from '@nestjs/common';
import { binance } from 'ccxt';
import * as moment from 'moment';

@Injectable()
export class AppService {
  constructor() {
    const apiKey = process.env.API_KEY;
    const secretKey = process.env.SECRET_KEY;

    this.exchange = new binance({
      apiKey: apiKey,
      secret: secretKey,
    });
    // this.exchange.setSandboxMode(true);
  }

  exchange: any;

  getBalance() {
    return this.exchange
      .fetchBalance()
      .then((result) => result.total)
      .catch((error) => {
        throw new BadRequestException(error);
      });
  }

  private async getCurrentPrice() {
    const result = await this.exchange.fetchLastPrices(['BNBUSDT']);

    return result['BNB/USDT']?.price;
  }

  async handleWebhook(type: string) {
    const currentBnbPrice = await this.getCurrentPrice();
    const lockedAmount = 450;
    const lotSize = 0.001;

    const timeStringNow = moment()
      .utcOffset('+0700')
      .format('HH:mm DD/MM/YYYY');

    const { BNB: bnbBalance, USDT: usdtBalance } = await this.getBalance();

    if (type === 'buy') {
      if (usdtBalance < lockedAmount) {
        console.log(timeStringNow + ': ' + 'No USDT for BUY');

        return;
      }

      const bnbAmount = (usdtBalance - lockedAmount) / currentBnbPrice;

      console.log(timeStringNow + ': ' + 'Buy BNB at price', {
        currentBnbPrice,
        bnbAmount,
      });

      if (process.env.IS_ACTIVE === 'true') {
        return this.exchange.createOrder(
          'BNBUSDT',
          'market',
          'buy',
          Math.floor(bnbAmount / lotSize) * lotSize,
        );
      }

      console.log('Just for test!!!');
      return { isCreateOrder: false };
    }

    if (type === 'sell') {
      const adjustedQuantity = Math.floor(bnbBalance / lotSize) * lotSize;

      if (adjustedQuantity < lotSize) {
        console.log(timeStringNow + ': ' + 'No BNB for SELL');
        return;
      }

      console.log(timeStringNow + ': ' + 'Sell BNB at price', {
        currentBnbPrice,
        bnb: adjustedQuantity,
      });

      if (process.env.IS_ACTIVE === 'true') {
        return this.exchange.createOrder(
          'BNBUSDT',
          'market',
          'sell',
          adjustedQuantity,
        );
      }

      console.log('Just for test!!!');

      return { isCreateOrder: false };
    }

    console.log(timeStringNow + ': ' + 'wrong type');
  }
}
