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
  }

  exchange: any;

  getBalance() {
    return this.exchange
      .fetchBalance()
      .then((result) => result.total)
      .catch((error) => error);
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    const result = await this.exchange.fetchLastPrices([symbol]);

    const PriceSymbol = {
      BTCBUSD: 'BTC/BUSD',
      ETHBUSD: 'ETH/BUSD',
      BNBBUSD: 'BNB/BUSD',
    };

    return result?.[PriceSymbol[symbol]]?.price || 0;
  }

  private logMessage(message, options?: any) {
    const timeStringNow = moment()
      .utcOffset('+0700')
      .format('HH:mm DD/MM/YYYY');

    console.log(timeStringNow, ':', message, options || '');
  }

  async byCoin(symbol: string, lotSize: number) {
    const currentPrice = await this.getCurrentPrice(symbol);

    if (!currentPrice) {
      throw new BadRequestException(`Can not fetch ${symbol} price!`);
    }

    const buySize = parseInt(process.env.BUY_SIZE) || 10;
    const actualAmount = parseFloat((buySize / currentPrice).toFixed(lotSize));

    this.logMessage(
      `Buy ${symbol} at ${currentPrice}\nAmount: ${actualAmount}\n`,
    );

    if (process.env.IS_ACTIVE === 'true') {
      return this.exchange.createOrder(symbol, 'market', 'buy', actualAmount);
    }

    console.log('Just for test!!!');
    return { isCreateOrder: false };
  }

  async handleWebhook(symbol: string, key: string) {
    if (key !== process.env.BOT_SECRET_KEY) {
      throw new ForbiddenException('Forbidden');
    }

    const lockedAmount = parseInt(process.env.LOCKED_SIZE) || 3;
    const buySize = parseInt(process.env.BUY_SIZE) || 10;
    const btcSymbol = 'BTCBUSD';
    const ethSymbol = 'ETHBUSD';
    const bnbSymbol = 'BNBBUSD';

    const { BUSD: busdBalance } = await this.getBalance();
    if (!busdBalance) {
      throw new BadRequestException('Can not fetch the balance');
    }

    const totalBusd = busdBalance - lockedAmount;
    if (totalBusd < buySize) {
      this.logMessage(`No BUSD to buy ${symbol}`);
      return;
    }

    switch (symbol) {
      case btcSymbol: {
        return this.byCoin(btcSymbol, 4);
      }

      case ethSymbol: {
        return this.byCoin(ethSymbol, 4);
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
