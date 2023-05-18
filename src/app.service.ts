import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
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
    const result = await this.exchange.fetchLastPrices(['BNBBUSD']);

    return result['BNB/BUSD']?.price;
  }

  async handleWebhook(type: string, key: string) {
    if (key !== process.env.BOT_SECRET_KEY) {
      throw new ForbiddenException('Forbidden');
    }

    const currentBnbPrice = await this.getCurrentPrice();
    const lockedAmount = 100;
    const lotSize = 0.001;

    const timeStringNow = moment()
      .utcOffset('+0700')
      .format('HH:mm DD/MM/YYYY');

    const { BNB: bnbBalance, BUSD: busdBalance } = await this.getBalance();

    if (type === 'buy') {
      const totalBusd = busdBalance - lockedAmount;
      if (totalBusd < lockedAmount) {
        console.log(timeStringNow + ': ' + 'No BUSD for BUY');

        return;
      }

      const bnbAmount = totalBusd / currentBnbPrice;

      console.log(timeStringNow + ': ' + 'Buy BNB at price', {
        currentBnbPrice,
        totalBusd,
        bnbAmount,
      });

      if (process.env.IS_ACTIVE === 'true') {
        return this.exchange.createOrder(
          'BNBBUSD',
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
          'BNBBUSD',
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
