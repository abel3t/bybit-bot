import { Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { Cron } from '@nestjs/schedule';
import { RestClientV5 } from 'bybit-api';

@Injectable()
export class AppService {
  constructor() {
    const apiKey = process.env.API_KEY;
    const secretKey = process.env.SECRET_KEY;
    const useTestnet = true;

    this.exchange = new RestClientV5({
      key: apiKey,
      secret: secretKey,
      testnet: useTestnet,
    });
  }

  exchange: any;

  getBalance() {
    return this.exchange.getAllCoinsBalance({
      accountType: 'CONTRACT',
      coin: 'USDT',
    });
  }

  @Cron('0 */15 * * * *')
  async getHello() {
    const symbol = 'BTCUSDT';

    enum Direction {
      Buy = 'Buy',
      Sell = 'Sell',
    }

    const tickers = (
      await this.exchange.getKline({
        category: 'linear',
        symbol,
        interval: '15',
        // start?: number;
        // end?: number;
        limit: 7,
      })
    )?.result?.list;

    let countRedTickers = 0;
    let countGreenTickers = 0;
    let firstPrice;
    let lastPrice;
    let direction;

    tickers.sort((a, b) => (a[0] > b[0] ? 1 : -1));

    let shouldOrder = false;

    tickers.forEach((x, i) => {
      const ticker = formatOHLCV(x);
      if (i === 0) {
        firstPrice = ticker.close;
        lastPrice = ticker.close;
        return;
      }

      if (i === tickers.length - 1) {
        if (ticker.close > lastPrice && countGreenTickers >= 3) {
          shouldOrder = true;
        }

        if (ticker.close < lastPrice && countRedTickers >= 3) {
          shouldOrder = true;
        }

        direction = ticker.close > lastPrice ? Direction.Sell : Direction.Buy;
        return;
      }

      if (ticker.close > ticker.open && ticker.close > lastPrice) {
        ++countGreenTickers;
        countRedTickers = 0;
      }

      if (ticker.close < ticker.open && ticker.close < lastPrice) {
        ++countRedTickers;
        countGreenTickers = 0;
      }

      lastPrice = ticker.close;
    });

    const changePercent = (Math.abs(firstPrice - lastPrice) / firstPrice) * 100;
    if (shouldOrder && changePercent > 1) {
      console.log(
        {
          firstPrice,
          lastPrice,
          countRedTickers,
          countGreenTickers,
          direction,
          percent: changePercent,
        },
        'DatLenhNe',
      );

      if (countRedTickers >= 3 || countGreenTickers >= 3) {
        const stopSlotPrice = lastPrice * 0.98;
        const takeProfitPrice = lastPrice * 1.0035;

        return this.exchange.submitOrder({
          category: 'linear',
          symbol,
          isLeverage: 1,
          side: 'Buy',
          orderType: 'Market',
          qty: '0.001',
          stopLoss: stopSlotPrice.toFixed(0),
          takeProfit: takeProfitPrice.toFixed(0),
          tpTriggerBy: 'MarkPrice',
          slTriggerBy: 'MarkPrice',
        });
      }
    } else {
      console.log('Không đặt lệnh đâu!');
      console.log({
        firstPrice,
        lastPrice,
        countRedTickers,
        countGreenTickers,
        direction,
        percent: changePercent,
      });
    }

    return {
      firstPrice,
      lastPrice,
      countRedTickers,
      countGreenTickers,
      direction,
      percent: changePercent,
    };
  }
}

const formatOHLCV = (price) => {
  return {
    timestamp: moment(parseInt(price[0])).format(),
    open: price[1],
    high: price[2],
    low: price[3],
    close: price[4],
    volume: price[5],
  };
};
