import { getKlineData, getTickers, TimeFrame } from '@/lib/bybit';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  
  try {
    if (action === 'kline') {
      const symbol = searchParams.get('symbol') || 'BTCUSDT';
      const interval = (searchParams.get('interval') || '1h') as TimeFrame;
      const limit = parseInt(searchParams.get('limit') || '200');
      
      const data = await getKlineData(symbol, interval, limit);
      return Response.json({ success: true, data });
    }
    
    if (action === 'tickers') {
      const symbols = searchParams.get('symbols')?.split(',');
      const data = await getTickers(symbols);
      return Response.json({ success: true, data });
    }
    
    return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Bybit API error:', error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
