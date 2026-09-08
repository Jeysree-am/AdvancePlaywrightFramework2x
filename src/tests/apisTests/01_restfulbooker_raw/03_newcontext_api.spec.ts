import{expect,test,request} from '@playwright/test';
import{logger} from '@utils/logger';
test('new context api for isolated headers',async()=>{
    const ctx= await request.newContext({
        baseURL:'https://gorest.in',
        extraHTTPHeaders:{'X-Trace-Id':'demo-123'},
        timeout:15000,

    });
    const ping = await ctx.get('/public/v2/users/1001?page=1&per_page=10');
    expect(ping.status()).toBe(200);
    await ctx.dispose();    
});