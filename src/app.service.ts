import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { binance } from 'ccxt';
import * as moment from 'moment';

@Injectable()
export class AppService {
  private previousBuyPrice;

  constructor() {
    const apiKey = process.env.API_KEY;
    const secretKey = process.env.SECRET_KEY;

    this.previousBuyPrice =
      parseInt(process.env.PREVIOUS_BUY_PRICE) || undefined;

    this.exchange = new binance({
      apiKey: apiKey,
      secret: secretKey,
    });
  }

  exchange: any;

  getBalance() {
    return this.exchange
      .fetchBalance()
      .then((result) => result.total)
      .catch((error) => error);
  }

  private async getCurrentPrice() {
    const result = await this.exchange.fetchLastPrices(['BNBBUSD']);

    return result['BNB/BUSD']?.price;
  }

  async handleWebhook(type: string, key: string) {
    if (key !== process.env.BOT_SECRET_KEY) {
      throw new ForbiddenException('Forbidden');
    }

    const lockedAmount = parseInt(process.env.LOCKED_SIZE) || 3;
    const buySize = parseInt(process.env.BUY_SIZE) || 10;
    const lotSize = 0.001;

    const timeStringNow = moment()
      .utcOffset('+0700')
      .format('HH:mm DD/MM/YYYY');

    const currentBnbPrice = await this.getCurrentPrice();
    if (!currentBnbPrice) {
      throw new BadRequestException(
        timeStringNow + ': ',
        'Can not fetch BNB price',
      );
    }

    const currentBuyPrice = Math.floor(currentBnbPrice);

    const { BNB: bnbBalance, BUSD: busdBalance } = await this.getBalance();
    if (!bnbBalance || !busdBalance) {
      throw new BadRequestException(
        timeStringNow + ': ',
        'Can not fetch the balance',
      );
    }

    if (type === 'buy') {
      if (currentBuyPrice === this.previousBuyPrice) {
        console.log(
          timeStringNow + ': ' + 'Bought BNB at price',
          currentBnbPrice,
        );
        return;
      }

      const totalBusd = busdBalance - lockedAmount;
      if (totalBusd < buySize) {
        console.log(timeStringNow + ': ' + 'No BUSD for BUY');

        return;
      }

      const bnbAmount = buySize / currentBnbPrice;

      console.log(timeStringNow + ': ' + 'Buy BNB at price', {
        currentBnbPrice,
        buySize,
        bnbAmount,
      });

      this.previousBuyPrice = currentBuyPrice;

      if (process.env.IS_ACTIVE === 'true') {
        const actualBnbAmount = Math.floor(bnbAmount / lotSize) * lotSize;
        const buyOrder = await this.exchange.createOrder(
          'BNBBUSD',
          'market',
          'buy',
          actualBnbAmount,
        );

        const ratio = 0.01; // 1%
        const tpPrice = Math.floor((currentBnbPrice * (1 + ratio)) / 0.1) * 0.1; // round price

        const sellOrder = await this.exchange.createOrder(
          'BNBBUSD',
          'limit',
          'sell',
          actualBnbAmount,
          tpPrice,
        );

        return {
          buyOrder,
          sellOrder,
        };
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
