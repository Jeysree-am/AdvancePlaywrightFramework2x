import{test,expect} from '@playwright/test';
import{logger} from '@utils/logger';
test.describe('PUT operation for Restful Booker API',()=>{
test('TC#2 @p0-PUT: Verify that update booking is working fine',async({request})=>{
    const baseUrl = process.env.API_BASE_URL||'https://restful-booker.herokuapp.com/';
    const headers={
        Accept:'application/json',
        'Content-Type':'application/json',

    };
    const payload={
        firstname:'James',
        lastname:'Brown',
        totalprice:111,
        depositpaid:true,
        bookingdates:{
            checkin:'2026-10-20',
            checkout:'2026-10-22',
        },
        additionalneeds:'breakfast',    
    } ;
    let token='';
    let bookingId=0;    await test.step('create auth token',async()=>{
        const responseData= await request.post(`${baseUrl}/auth`,{
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                "username": "admin",
                "password": "password123"
            }
        });
        expect(responseData.status()).toBe(200);
        const data = await responseData.json();
        token = data.token;
        expect(token).toBeTruthy();
        logger.info('Auth Token Created Successfully for Put Operation');


    });
    await test.step('create booking for update',async()=>{
        const responseData= await request.post(`${baseUrl}/booking`,{
            headers: {
                'Content-Type': 'application/json'
            },
            data: payload,
        }); 
        expect(responseData.status()).toBe(200);
        const data = await responseData.json();
        bookingId = data.bookingid;
        expect(bookingId).toBeTruthy();
        logger.info(`Booking Created Successfully for Update Operation with Booking Id: ${bookingId}`);
    });
        

    await test.step('update booking',async()=>{
        const responseData= await request.put(`${baseUrl}/booking/${bookingId}`,{
            headers: { 
                ...headers,
                Cookie:`token=${token}`, 
            },
            data: payload,
        }); 
        expect(responseData.status()).toBe(200);
        const data = await responseData.json();
        expect(data.firstname).toBe(payload.firstname);
        expect(data.lastname).toBe(payload.lastname);
        logger.info(`updated booking Id: ${bookingId}:${data.firstname} ${data.lastname}`);

    });
});
});
