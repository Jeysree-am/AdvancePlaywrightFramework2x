import{test,expect} from '@playwright/test';

test('api testing-GET for healthcheck',async({request})=>{

    const responseData=await request.get("/ping");
    console.log(responseData);
    expect(responseData.status()).toBe(201);
});