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
  private samePriceTimes = 0;

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
    const result = await this.exchange.fetchLastPrices(['BTCBUSD']);

    return result['BTC/BUSD']?.price;
  }

  async handleWebhook(
    type: string,
    key: string,
    size?: number,
    tpRatio?: number,
  ) {
    if (key !== process.env.BOT_SECRET_KEY) {
      throw new ForbiddenException('Forbidden');
    }

    const lockedAmount = parseInt(process.env.LOCKED_SIZE) || 3;
    const buySize = size || parseInt(process.env.BUY_SIZE) || 10;
    const lotSize = 0.001;

    const timeStringNow = moment()
      .utcOffset('+0700')
      .format('HH:mm DD/MM/YYYY');

    const currentBtcPrice = await this.getCurrentPrice();
    if (!currentBtcPrice) {
      throw new BadRequestException(
        timeStringNow + ': ',
        'Can not fetch BTC price',
      );
    }

    const currentBuyPrice = Math.floor(currentBtcPrice);

    const { BTC: btcBalance, BUSD: busdBalance } = await this.getBalance();
    if (!btcBalance || !busdBalance) {
      throw new BadRequestException(
        timeStringNow + ': ',
        'Can not fetch the balance',
      );
    }

    if (type === 'buy') {
      if (
        currentBuyPrice === this.previousBuyPrice &&
        this.samePriceTimes >= 3
      ) {
        console.log(
          timeStringNow + ': ' + 'Bought BTC at price',
          currentBtcPrice,
          this.samePriceTimes,
          'times',
        );
        return;
      }

      if (currentBuyPrice === this.previousBuyPrice) {
        ++this.samePriceTimes;
      } else {
        this.samePriceTimes = 0;
      }

      const totalBusd = busdBalance - lockedAmount;
      if (totalBusd < buySize) {
        console.log(timeStringNow + ': ' + 'No BUSD for BUY');

        return;
      }

      const btcAmount = buySize / currentBtcPrice;
      const actualBtcAmount = Math.floor(btcAmount / lotSize) * lotSize;
      const ratio = tpRatio || parseFloat(process.env.TP_RATIO) || 0.0075;

      console.log(timeStringNow + ': ' + 'Buy BTC at price', {
        currentBtcPrice,
        buySize,
        btcAmount: actualBtcAmount,
        ratio,
      });

      this.previousBuyPrice = currentBuyPrice;

      if (process.env.IS_ACTIVE === 'true') {
        return this.exchange.createOrder(
          'BTCBUSD',
          'market',
          'buy',
          actualBtcAmount,
        );
      }

      console.log('Just for test!!!');
      return { isCreateOrder: false };
    }

    if (type === 'sell') {
      const adjustedQuantity = Math.floor(btcBalance / lotSize) * lotSize;

      if (adjustedQuantity < lotSize) {
        console.log(timeStringNow + ': ' + 'No BTC for SELL');
        return;
      }

      console.log(timeStringNow + ': ' + 'Sell BTC at price', {
        currentBtcPrice,
        btc: adjustedQuantity,
      });

      if (process.env.IS_ACTIVE === 'true') {
        return this.exchange.createOrder(
          'BTCBUSD',
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
